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