const t = require('babel-types')

module.exports = (_, options) => {
    const libraryName = (options || {}).libraryName || '';

    return {
        visitor: {
            // 对import进行查询转换
            ImportDeclaration(path, _ref = {opts: {}}) {
                const sourceValue = path.node.source.value || '';
                if (sourceValue.indexOf(libraryName) >= 0) {
                    // path.remove();
                    //todo
                }
            }
        }
    };
};