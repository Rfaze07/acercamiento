const model = require('./model')
const utils = require('../../../utils')
const eventos = require("../../eventos/controller")

exports.getLista = async (req, res) => {
    try {
        res.render('web/noticias/views/index', {
            pagename: "Noticias",
        })
    }
    catch (error) {
        console.log(error)
        res.redirect('/inicio')
    }
}

exports.getListaAjax = async (req, res) => {
    try {
        const data = await model.getAll()
        res.json({ status: true, data })
    }
    catch (error) {
        console.error(error)
        return res.status(500).json({ status: false, text: "Hubo un error al procesar la solicitud" })
    }
}