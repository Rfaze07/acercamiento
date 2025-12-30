const model = require('./model')
const utils = require('../../../utils')
const eventos = require("../../eventos/controller")

exports.getLista = async (req, res) => {
    try {
        res.render('web/equipos/views/index', {
            pagename: "Equipos",
        })
    }
    catch (error) {
        console.log(error)
        res.redirect('/inicio')
    }
}