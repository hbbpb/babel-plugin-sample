import asyncModule from './lib'
// import asyncModule2 from './lib2'

const init = async () => {

    const {asyncModule2} = await import('./lib2')

    const result = asyncModule()
    const result2 = (await asyncModule2).test()


    console.log(result)
    console.log(result2)
}

init();