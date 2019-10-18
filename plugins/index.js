const t = require('@babel/types');
const template = require('@babel/template').default;

/**
 * todo: 1、区别处理import A, import { A, B }, import A, { B }状态
 *          (目前想法是，只处理import A这种情况，其他直接跳过)
 *       2、处理loadComponent方法的位置。目前考虑挂到window上
 */

const hasVueUse = (binding) => {
  let has = false;
  if (!binding) {
    return has;
  }
  const { referencePaths } = binding;
  if (!referencePaths || !referencePaths.length) {
    return has;
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
          has = true;
        }
      }
    }
  });
  return has;
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

        const isImportDefault =
          specifiers &&
          specifiers.length === 1 &&
          t.isImportDefaultSpecifier(specifiers[0]);
        if (!isImportDefault) {
          return;
        }

        const { value: importPath = '' } = source;
        const isPathProcessable =
          importPath && ~importPath.indexOf(libraryName);
        if (!isPathProcessable) {
          return;
        }

        const bundle = importPath.slice(libraryName.length + 1).split('/')[0];
        const isBundleInvalid = exclude.includes(bundle);
        if (isBundleInvalid) {
          return;
        }

        const {
          local: { name: identifierName }
        } = specifiers[0];
        if (hasVueUse(bindings[identifierName])) {
          return;
        }

        const buildFunc = template(`
          const %%varName%% = () => loadComponent(%%bundle%%)
        `);
        const ast = buildFunc({
          varName: t.identifier(identifierName),
          bundle: t.stringLiteral(bundle)
        });
        path.replaceWith(ast);
      }
    }
  };
};
