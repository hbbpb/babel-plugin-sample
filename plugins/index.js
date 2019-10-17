const t = require('@babel/types');
const template = require('@babel/template').default;

module.exports = (_, option = {}) => {
  console.log(template);
  const { libraryName = '', exclude = [] } = option;
  return {
    visitor: {
      ImportDeclaration(path, state = { opts: {} }) {
        const { node } = path;
        const { source, specifiers } = node;
        const { value: importPath = '' } = source;
        if (!importPath || !~importPath.indexOf(libraryName)) {
          return;
        }
        const comp = importPath.slice(libraryName.length + 1).split('/')[0];
        if (exclude.includes(comp)) {
          return;
        }
        const buildFunc = template(`
          const %%varName%% = () => loadComponent(%%bundle%%)
        `);
        console.log(buildFunc);
        const ast = buildFunc({
          varName: t.identifier(comp),
          bundle: t.stringLiteral(comp)
        });
        path.replaceWith(ast);
        // console.log(specifiers);
      }
    }
  };
};
