const model = require('./model')
const filtrosModel = require('../filtros/model')

exports.getLista = async (req, res) => {
    try {
        const filtros = await filtrosModel.getCompetenciasYCategorias()
        res.render('web/lideres/views/index', {
            pagename: "Lideres de estadisticas",
            filtros
        })
    }
    catch (error) {
        console.error(error)
        res.status(500).send('No se pudieron cargar las competencias.')
    }
}

exports.getListaAjax = async (req, res) => {
    try {
        const idTorneo = Number(req.body && req.body.idTorneo)
        const idCategoria = Number(req.body && req.body.idCategoria)
        if (!Number.isSafeInteger(idTorneo) || idTorneo < 1 ||
            !Number.isSafeInteger(idCategoria) || idCategoria < 1) {
            return res.status(400).json({ status: false, text: "Seleccione una competencia y una categoría válidas" })
        }
        const [goleadores, asistidores, reboteadores, pegadores] = await Promise.all([
            model.getMayoresGoleadores(idTorneo, idCategoria),
            model.getMayoresAsistidores(idTorneo, idCategoria),
            model.getMayoresReboteadores(idTorneo, idCategoria),
            model.getMayoresPegadores(idTorneo, idCategoria)
        ])
        const data = {
            goleadores,
            asistidores,
            reboteadores,
            pegadores
        }
        res.json({ status: true, data })
    }
    catch (error) {
        console.error(error)
        return res.status(500).json({ status: false, text: "Hubo un error al procesar la solicitud" })
    }
}