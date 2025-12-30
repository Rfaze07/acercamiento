const model = require('./model')
const utils = require('../../../utils')
const eventos = require("../../eventos/controller")

exports.getLista = async (req, res) => {
    try {
        res.render('web/partidos/views/index', {
            pagename: "Partidos",
        })
    }
    catch (error) {
        console.log(error)
        res.redirect('/inicio')
    }
}