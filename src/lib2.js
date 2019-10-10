const init = async () => {
    const {default: asyncModule} = await import('./lib')
    return {
        test: () => asyncModule() + '2'
    }
}

const asyncModule2 = init()

export {asyncModule2}