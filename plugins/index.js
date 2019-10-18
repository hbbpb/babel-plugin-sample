const t = require('@babel/types');
const template = require('@babel/template').default;

/**
 * todo: 1、区别处理import A, import { A, B }, import A, { B }状态
 *          (目前想法是，只处理import A这种情况，其他直接跳过)
 *       2、判断被引用的位置，区别处理import
 *       3、处理loadComponent方法的位置
 */

module.exports = (_, option = {}) => {
  const { libraryName = '', exclude = [] } = option;
  return {
    visitor: {
      ImportDeclaration(path, state = { opts: {} }) {
        const { node } = path;
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
