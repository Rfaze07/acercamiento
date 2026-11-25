const model = require('./model')

exports.getLista = async (req, res) => {
    try {
        const [resumenRows, partidosEnVivo, ultimosPartidos, proximosPartidos] = await Promise.all([
            model.getResumen(),
            model.getPartidosEnVivo(),
            model.getUltimosPartidos(),
            model.getProximosPartidos()
        ])
        const prepararPartidos = partidos => partidos.map(partido => {
            const [anio, mes, dia] = String(partido.fechaPartido).split('-')
            partido.fechaFormateada = `${dia}/${mes}/${anio}`
            partido.horaFormateada = partido.horaPartido
            partido.periodoActual = Number(partido.periodoActual) || 1
            partido.competencia = [partido.tipoCompetencia, partido.torneo, partido.temporada, partido.categoria, partido.fase]
                .filter(Boolean)
                .join(' · ')
            return partido
        })
        res.render('web/index/views/index', {
            pagename: "Inicio",
            resumen: resumenRows[0],
            partidosEnVivo: prepararPartidos(partidosEnVivo),
            ultimosPartidos: prepararPartidos(ultimosPartidos),
            proximosPartidos: prepararPartidos(proximosPartidos)
        })
    }
    catch (error) {
        console.error(error)
        res.status(500).send('No se pudo cargar la información del sitio.')
    }
}