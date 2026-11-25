const model = require('./model')
const filtrosModel = require('../filtros/model')

exports.getLista = async (req, res) => {
    try {
        const filtros = await filtrosModel.getCompetenciasYCategorias()
        res.render('web/equipos/views/index', {
            pagename: "Equipos",
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
        const filas = await model.getAll(idTorneo, idCategoria)
        const equipos = new Map()
        for (const fila of filas) {
            if (!equipos.has(fila.idTorneoEquipo)) {
                equipos.set(fila.idTorneoEquipo, {
                    id: fila.idTorneoEquipo,
                    idEquipo: fila.idEquipo,
                    nombre: fila.nombreEquipo,
                    torneo: fila.torneo,
                    temporada: fila.temporada,
                    tipoCompetencia: fila.tipoCompetencia,
                    categoria: fila.categoria,
                    rama: fila.rama,
                    jugadores: []
                })
            }
            if (fila.idJugador !== null) {
                equipos.get(fila.idTorneoEquipo).jugadores.push({
                    nombre: fila.nombreJugador,
                    dorsal: fila.dorsal
                })
            }
        }
        res.json({ status: true, data: Array.from(equipos.values()) })
    }
    catch (error) {
        console.error(error)
        return res.status(500).json({ status: false, text: "Hubo un error al procesar la solicitud" })
    }
}