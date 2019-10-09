(function (global) {

    function initModule(libNames) {
        return Promise.all(libNames.map(name => {
            return getModuleByName(name)
        }))
    }

    function getModuleByName(name) {
        const url = convertModuleNameToUrl(name)
        return fetch(url)
    }

    function convertModuleNameToUrl(name) {
        //todo
    }

    global._initModule = initModule

})(window)