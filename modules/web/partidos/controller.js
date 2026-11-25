const model = require('./model')
const filtrosModel = require('../filtros/model')

exports.getLista = async (req, res) => {
    try {
        const filtros = await filtrosModel.getCompetenciasYCategorias()
        res.render('web/partidos/views/index', { 
            pagename: "Partidos",
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
        const data = await model.getAll(idTorneo, idCategoria)
        res.json({ status: true, data })
    }
    catch (error) {
        console.error(error)
        return res.status(500).json({ status: false, title: "Error", text: "Hubo un error al procesar la solicitud" })
    }
}

exports.getListaDetalles = async (req, res) => {
    try {
        const idPartido = Number(req.query.id)
        if (!Number.isSafeInteger(idPartido) || idPartido < 1) {
            return res.redirect('/web/partidos')
        }
        res.render('web/partidos/views/detallePartidos', { 
            pagename: "Detalle de Partidos",
            idPartido
        })
    }
    catch (error) {
        console.log(error)
        res.redirect('/inicio')
    }
}

exports.getListaDetallesAjax = async (req, res) => {
    try {
        const idPartido = Number(req.body.idPartido)
        if (!Number.isSafeInteger(idPartido) || idPartido < 1) {
            return res.status(400).json({ status: false, text: "El identificador del partido no es válido" })
        }
        const [partido, estadisticas, periodo] = await Promise.all([
            model.getById(idPartido),
            model.getEstadisticasPorPartido(idPartido),
            model.getPeriodoActual(idPartido)
        ])
        if (!partido.length) {
            return res.status(404).json({ status: false, text: "No se encontró el partido solicitado" })
        }

        const idEquipoA = Number(partido[0].id_equipoA_fk)
        const idEquipoB = Number(partido[0].id_equipoB_fk)
        const estadisticasA = estadisticas.filter(jugador => Number(jugador.idEquipo) === idEquipoA)
        const estadisticasB = estadisticas.filter(jugador => Number(jugador.idEquipo) === idEquipoB)
        res.json({ status: true, partido, estadisticasA, estadisticasB, periodo })
    }
    catch (error) {
        console.error(error)
        return res.status(500).json({ status: false, text: "Hubo un error al procesar la solicitud" })
    }
}

