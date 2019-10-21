const t = require('@babel/types');
const template = require('@babel/template').default;

/**
 * todo: 1、区别处理import A, import { A, B }, import A, { B }状态
 *          (目前想法是，只处理import A这种情况，其他直接跳过)
 *       2、处理loadComponent方法的位置。目前考虑挂到window上
 */

const isUsedByVueUse = (binding) => {
  let isUsed = false;
  if (!binding) {
    return isUsed;
  }
  const { referencePaths } = binding;
  if (!referencePaths || !referencePaths.length) {
    return isUsed;
  }
  referencePaths.forEach((refPath) => {
    const { parent } = refPath;
    if (t.isCallExpression(parent)) {
      const { callee } = parent;
      if (t.isMemberExpression(callee)) {
        const {
          object: { name: objName },
          property: { name: propName }
        } = callee;
        if (objName === 'Vue' && propName === 'use') {
          isUsed = true;
        }
      }
    }
  });
  return isUsed;
};

module.exports = (_, option = {}) => {
  const { libraryName = '', exclude = [] } = option;
  return {
    visitor: {
      ImportDeclaration(path, state = { opts: {} }) {
        const {
          node,
          scope: { bindings }
        } = path;
        const { source, specifiers } = node;

        // 判断并跳过引用源非libraryName的import引用
        const { value: importPath = '' } = source;
        const isPathProcessable =
          importPath && ~importPath.indexOf(libraryName);
        if (!isPathProcessable) {
          return;
        }

        // 引用路径libraryName/bundle，跳过bundle不存在或在exclude列表中的引用
        const bundle = importPath.slice(libraryName.length + 1).split('/')[0];
        const isBundleInvalid = !bundle || exclude.includes(bundle);
        if (isBundleInvalid) {
          return;
        }

        // 跳过import ('test')的情况
        if (!specifiers || !specifiers.length) {
          return;
        }

        const arrayAsts = [];
        let hasVueUsedIdentifier = false; // 判断所有specifier中的identifier是否有被Vue.use用到
        specifiers.forEach((specifier) => {
          const {
            local: { name: identifierName }
          } = specifier;
          const isUsedByVue = isUsedByVueUse(bindings[identifierName]);
          const isImportDefaultSpecifier = t.isImportDefaultSpecifier(
            specifier
          );
          if (isUsedByVue) {
            // 被Vue.use用到的保持不变
            hasVueUsedIdentifier = true;
            const retainTemplate = isImportDefaultSpecifier
              ? `import %%identifierName%% from %%path%%;`
              : `import { %%identifierName%% } from %%path%%;`;
            const retainFunc = template(retainTemplate);
            arrayAsts.push(
              retainFunc({
                identifierName: t.identifier(identifierName),
                path: t.stringLiteral(importPath)
              })
            );
          } else {
            // 未被用到，替换为工具方法获取
            const replaceTemplate = isImportDefaultSpecifier
              ? `const %%identifierName%% = () => loadComponent(%%bundle%%);`
              : `const %%identifierName%% = () => loadComponent(%%bundle%%, %%identifierName%%);`;
            const replaceFunc = template(replaceTemplate);
            arrayAsts.push(
              replaceFunc({
                identifierName: t.identifier(identifierName),
                bundle: t.stringLiteral(bundle)
              })
            );
          }
        });

        /**
         * 如果没有需要被替换的ast 或 有且仅有一个且被Vue.use用到，则跳过处理。
         * 有且仅有一个且被Vue.use使用时，如果不跳过处理会死循环。
         * 暂时没有找到只删除path中的node/identifier的API，只能对path进行处理，
         */
        if (
          !arrayAsts.length ||
          (hasVueUsedIdentifier && specifiers.length === 1)
        ) {
          return;
        }

        path.replaceWithMultiple(arrayAsts);
      }
    }
  };
};
