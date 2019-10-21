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

        const { value: importPath = '' } = source;
        const isPathProcessable =
          importPath && ~importPath.indexOf(libraryName);
        if (!isPathProcessable) {
          return;
        }

        const bundle = importPath.slice(libraryName.length + 1).split('/')[0];
        const isBundleInvalid = !bundle || exclude.includes(bundle);
        if (isBundleInvalid) {
          return;
        }

        if (!specifiers || !specifiers.length) {
          return;
        }

        const arrayAsts = [];
        let hasVueUsedIdentifier = false;
        specifiers.forEach((specifier) => {
          const {
            local: { name: identifierName }
          } = specifier;
          const isUsedByVue = isUsedByVueUse(bindings[identifierName]);
          const isImportDefaultSpecifier = t.isImportDefaultSpecifier(
            specifier
          );
          console.log(`${identifierName}: ${isUsedByVue}`);
          if (isUsedByVue) {
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
