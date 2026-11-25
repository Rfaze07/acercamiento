const model = require('./model')
const utils = require('../../utils')
const eventos = require("../eventos/controller")


exports.getLista = async (req, res) => {
    try {
        res.render('partidos/views/index', {
            pagename: "Partidos",
            permisos: req.session.user.permisos
        })
    } catch (error) {
        console.log(error)
        res.redirect('/inicio')
    }
}

exports.getListaAjax = async (req, res) => {
    try {
        const filtros = req.body || {}
        let params=[],
            query = `
                SELECT p.*, eA.nombre AS equipoA, eB.nombre AS equipoB,
                    c.nombre AS categoria, c.id_torneo_fk,
                    t.nombre AS torneo, t.temporada, f.nombre AS fase
                FROM partidos p
                LEFT JOIN equipos eA ON p.id_equipoA_fk = eA.id
                LEFT JOIN equipos eB ON p.id_equipoB_fk = eB.id
                LEFT JOIN torneos_categorias c ON c.id = p.id_torneo_categoria_fk
                LEFT JOIN torneos t ON t.id = c.id_torneo_fk
                LEFT JOIN fases f ON f.id = p.id_fase_fk AND f.id_torneo_categoria_fk = c.id
                WHERE 1=1
        `
        if(filtros.equipo != 't'){
            query += ' AND (p.id_equipoA_fk = ? OR p.id_equipoB_fk = ?)'
            params.push(filtros.equipo, filtros.equipo)
        }

        if(filtros.estado != 't'){
            query += ' AND p.estado = ?'
            params.push(filtros.estado)
        }

        for (const [filtro, columna, etiqueta] of [
            ["torneo", "c.id_torneo_fk", "torneo"],
            ["categoria", "p.id_torneo_categoria_fk", "categoría"],
            ["fase", "p.id_fase_fk", "fase"]
        ]) {
            if (filtros[filtro] && filtros[filtro] !== "t") {
                const id = Number(filtros[filtro])
                if (!Number.isInteger(id) || id < 1) {
                    return res.status(400).json({ status: false, text: `El filtro de ${etiqueta} no es válido` })
                }
                query += ` AND ${columna} = ?`
                params.push(id)
            }
        }

        if (filtros.fecha_desde) {
            if (!esFechaIso(filtros.fecha_desde)) return res.status(400).json({ status: false, text: "La fecha inicial del filtro no es válida" })
            query += " AND p.fecha_hora >= ?"
            params.push(`${filtros.fecha_desde} 00:00:00`)
        }
        if (filtros.fecha_hasta) {
            if (!esFechaIso(filtros.fecha_hasta)) return res.status(400).json({ status: false, text: "La fecha final del filtro no es válida" })
            query += " AND p.fecha_hora < DATE_ADD(?, INTERVAL 1 DAY)"
            params.push(`${filtros.fecha_hasta} 00:00:00`)
        }

        if (filtros.fecha_desde && filtros.fecha_hasta && filtros.fecha_desde > filtros.fecha_hasta) {
            return res.status(400).json({ status: false, text: "El rango de fechas no es válido" })
        }

        query += ' ORDER BY p.fecha_hora'
        let data = await model.execQuery(query, params)

        if(!data.length) return res.json({ status: false, icon:"warning", title: "Alerta", text: "No existen registros cargados" })
        res.json({ status: true, data })
    } catch (error) {
        console.log(error)
        return res.json({ status: false, con:"", title: "Error", text: "Hubo un error al procesar la solicitud" })
    }
}

exports.getListaSelectAjax = async (req, res) => {
    try {
        const data = await model.getAllbyActivo(1)
        if(!data.length) return res.json({ status: false, icon:"warning", title: "Alerta", text: "No existen rubros cargados" })
        return res.json({ status: true, data })
    } catch (error) {
        console.log(error)
        return res.json({ status: false, icon: "error", title: "Error", text: "Hubo un error al procesar la solicitud" })
    }
}

exports.getCategoriasParaPartido = async (req, res) => {
    try {
        const data = await model.getCategoriasParaPartido()
        return res.json({ status: true, data })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ status: false, text: "No se pudieron cargar las categorías de torneo" })
    }
}

exports.getOpcionesClasificacion = async (req, res) => {
    try {
        const data = await model.getOpcionesClasificacion()
        return res.json({ status: true, data })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ status: false, text: "No se pudieron cargar torneos, categorías y fases" })
    }
}

exports.getEquiposPorCategoria = async (req, res) => {
    const categoriaId = Number((req.body || {}).id_categoria)
    if (!Number.isInteger(categoriaId) || categoriaId < 1) {
        return res.json({ status: false, text: "La categoría seleccionada es inválida" })
    }
    try {
        const data = await model.getEquiposPorCategoria(categoriaId)
        return res.json({ status: true, data })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ status: false, text: "No se pudieron cargar los equipos de la categoría" })
    }
}

exports.postAlta = async (req, res) => {
    try {
        const validaciones = await ValidarCampos(req.body)
        if(!validaciones.status) return res.json(validaciones)

        let resInsert = await model.insert(req.body)
        if(!resInsert.affectedRows) return res.json({ status: false, icon:"error", title: "Error", text: "Hubo un error al procesar la solicitud" })
        await eventos.insertarEvento({ usuario: req.session.user.id, tabla: "Rubros", acc: "a", registro: resInsert.insertId })
        res.json({ status: true, icon:"success", title: "Éxito", text: "Solicitud procesada correctamente" })
    } catch (error) {
        console.log(error)
        return res.json({ status: false, icon:'error', title: "Error", text: "Hubo un error al procesar la solicitud" })
    }
}

exports.getById = async (req, res) => {    
    const data = await model.getById(req.body.id)
    if(!data.length) return res.json({ status: false, icon:'error', title: "Error", text: "No existen registros cargados" })
    res.json({ status: true, data: data[0] })
}

exports.postModificar = async (req, res) => {
    try {
        const validaciones = await ValidarCampos(req.body)
        if(!validaciones.status) return res.json(validaciones)

        const partidoActual = await model.getById(req.body.id)
        if (!partidoActual.length) return res.status(404).json({ status: false, text: "El partido solicitado no existe" })
        if (Number(partidoActual[0].estado) !== 0) {
            return res.status(409).json({ status: false, text: "No se puede modificar un partido iniciado o finalizado" })
        }
        const convocatoria = await model.getConvocatoriaActual(req.body.id)
        const cambioEquipos = Number(partidoActual[0].id_equipoA_fk) !== req.body.id_equipoA_fk ||
            Number(partidoActual[0].id_equipoB_fk) !== req.body.id_equipoB_fk ||
            (Number(partidoActual[0].id_torneo_categoria_fk) || null) !== req.body.id_torneo_categoria_fk ||
            (Number(partidoActual[0].id_fase_fk) || null) !== req.body.id_fase_fk
        if (convocatoria.length && cambioEquipos) {
            return res.status(409).json({ status: false, text: "No se pueden cambiar los equipos, la categoría o la fase después de guardar la convocatoria" })
        }
        let result = await model.update(req.body)
        if(result.affectedRows == 0) return res.json({ status: false, icon:'error', title: "Error", text: "Hubo un error al procesar la solicitud" })
        await eventos.insertarEvento({ usuario: req.session.user.id, tabla: "Rubros", acc: "m", registro: req.body.id })
        return res.json({ status: true, icon: "success", title: "Éxito", text: "Solicitud procesada correctamente" })
    } catch (error) {
        console.log(error)
        return res.json({ status: false, icon: "error", title: "Error", text: "Hubo un error al procesar la solicitud" })
    }
}

exports.postEliminar = async (req, res) => {
    try {
        let result = await model.delete(req.body.id)
        if(result.affectedRows == 0) return res.json({ status: false, icon: "error", title: "Error", text: "Hubo un error al procesar la solicitud" })
        await eventos.insertarEvento({ usuario: req.session.user.id, tabla: "Rubros", acc: "b", registro: req.body.id })            
        return res.json({ status: true, icon: "success", title: "Éxito", text: "Solicitud procesada correctamente" })
    } catch (error) {
        console.log(error)
        return res.json({ status: false, icon: "error", title: "Error", text: "Hubo un error al procesar la solicitud" })
    }
}

const ValidarCampos = async o => {
    if (!o || typeof o.fecha_hora !== "string" || !o.fecha_hora.trim()) {
        return { status: false, icon: "warning", title: "Alerta", text: "El campo Fecha y Hora es obligatorio" }
    }
    const equipoA = Number(o.id_equipoA_fk)
    const equipoB = Number(o.id_equipoB_fk)
    if (!Number.isInteger(equipoA) || equipoA < 1) {
        return { status: false, icon: "warning", title: "Alerta", text: "Seleccione el Equipo A" }
    }
    if (!Number.isInteger(equipoB) || equipoB < 1) {
        return { status: false, icon: "warning", title: "Alerta", text: "Seleccione el Equipo B" }
    }
    if (equipoA === equipoB) {
        return { status: false, icon: "warning", title: "Alerta", text: "Los equipos no pueden ser los mismos" }
    }
    const [fechaIngresada, hora] = o.fecha_hora.trim().split(/\s+/)
    if (!fechaIngresada || !hora || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(hora)) {
        return { status: false, icon: "warning", title: "Alerta", text: "Ingrese una fecha y hora válidas" }
    }
    const partesFecha = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fechaIngresada)
    if (!partesFecha) {
        return { status: false, icon: "warning", title: "Alerta", text: "Ingrese una fecha válida" }
    }
    const fechaValidada = new Date(Number(partesFecha[3]), Number(partesFecha[2]) - 1, Number(partesFecha[1]))
    if (fechaValidada.getFullYear() !== Number(partesFecha[3]) ||
        fechaValidada.getMonth() !== Number(partesFecha[2]) - 1 ||
        fechaValidada.getDate() !== Number(partesFecha[1])) {
        return { status: false, icon: "warning", title: "Alerta", text: "Ingrese una fecha válida" }
    }
    const fecha = utils.changeDateYMD(fechaIngresada)
    let categoriaId = null
    let torneoId = null
    if (o.id_torneo_categoria_fk !== "" && o.id_torneo_categoria_fk != null) {
        categoriaId = Number(o.id_torneo_categoria_fk)
        if (!Number.isInteger(categoriaId) || categoriaId < 1) {
            return { status: false, icon: "warning", title: "Alerta", text: "La categoría seleccionada es inválida" }
        }
        const inscriptos = await model.validarEquiposCategoria(categoriaId, equipoA, equipoB)
        if (!inscriptos.length || Number(inscriptos[0].cantidad) !== 2) {
            return { status: false, icon: "warning", title: "Alerta", text: "Ambos equipos deben estar confirmados en la categoría seleccionada" }
        }
        if (o.id_torneo_fk !== "" && o.id_torneo_fk != null) {
            torneoId = Number(o.id_torneo_fk)
            if (!Number.isInteger(torneoId) || torneoId < 1 || Number(inscriptos[0].id_torneo_fk) !== torneoId) {
                return { status: false, icon: "warning", title: "Alerta", text: "La categoría no pertenece al torneo seleccionado" }
            }
        }
    } else if (o.id_torneo_fk !== "" && o.id_torneo_fk != null) {
        return { status: false, icon: "warning", title: "Alerta", text: "Seleccione una categoría para asignar el torneo" }
    }
    let faseId = null
    if (o.id_fase_fk !== "" && o.id_fase_fk != null) {
        faseId = Number(o.id_fase_fk)
        if (!categoriaId || !Number.isInteger(faseId) || faseId < 1) {
            return { status: false, icon: "warning", title: "Alerta", text: "La fase seleccionada requiere una categoría válida" }
        }
        const fase = await model.validarFaseCategoria(faseId, categoriaId)
        if (!fase.length || Number(fase[0].cantidad) !== 1) {
            return { status: false, icon: "warning", title: "Alerta", text: "La fase no pertenece a la categoría seleccionada" }
        }
    }
    o.id_equipoA_fk = equipoA
    o.id_equipoB_fk = equipoB
    o.id_torneo_categoria_fk = categoriaId
    o.id_torneo_fk = torneoId
    o.id_fase_fk = faseId
    o.fecha_hora = `${fecha} ${hora}`
    return { status: true }
}

const esFechaIso = fecha => {
    if (typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false
    const [anio, mes, dia] = fecha.split("-").map(Number)
    const fechaValidada = new Date(Date.UTC(anio, mes - 1, dia))
    return fechaValidada.getUTCFullYear() === anio &&
        fechaValidada.getUTCMonth() === mes - 1 &&
        fechaValidada.getUTCDate() === dia
}

exports.postActualizarEstado = async (req, res) => {
    try {
        const { id, puntosA, puntosB } = req.body
        const partidoId = Number(id)
        const estado = Number(req.body.estado)
        if (!Number.isInteger(partidoId) || partidoId < 1 || ![0, 1, 2].includes(estado)) {
            return res.status(400).json({ status: false, text: "Los datos del estado del partido no son válidos" })
        }
        if (estado === 1) {
            const convocados = await model.getConvocatoriaActual(partidoId)
            const titulares = { A: 0, B: 0 }
            convocados.forEach(jugador => {
                if (Number(jugador.es_titular) === 1) titulares[jugador.lado]++
            })
            if (titulares.A !== 5 || titulares.B !== 5) {
                return res.status(400).json({ status: false, text: "Antes de comenzar, guarde cinco titulares por equipo en la convocatoria" })
            }
        }
        let result = await model.updateEstado(partidoId, estado, Number(puntosA) || 0, Number(puntosB) || 0)
        if(result.affectedRows == 0) return res.json({ status: false, icon:'error', title: "Error", text: "Hubo un error al procesar la solicitud" })
        return res.json({ status: true, icon: "success", title: "Éxito", text: "Estado actualizado correctamente" });
    } catch (error) {
        console.error(error)
        return res.status(500).json({ status: false, icon: "error", title: "Error", text: "Hubo un error al procesar la solicitud" })
    }
}

exports.getPlanillaDigital = async (req, res) => {
    try {
        res.render('partidos/views/planillaDigital', {
            pagename: "Planilla Digital",
            permisos: req.session.user.permisos
        })
    } catch (error) {
        console.log(error)
        res.redirect('/partidos')
    }
}

exports.postRegistrarEstadistica = async (req, res) => {
    try {
        const body = req.body || {}
        const partidoId = Number(body.id_partido_fk)
        const jugadorId = Number(body.id_jugador_fk)
        const valor = Number(body.valor)
        const periodo = Number(body.periodo)
        const tiempoRestante = Number(body.tiempo_restante)
        const eventosValidos = ["puntos", "rebotes", "asistencias", "faltas", "falta_tecnica", "falta_antideportiva"]
        if (!Number.isInteger(partidoId) || partidoId < 1 ||
            !Number.isInteger(jugadorId) || jugadorId < 1 ||
            !eventosValidos.includes(body.evento) ||
            !Number.isInteger(valor) || valor < 1 || valor > (body.evento === "puntos" ? 3 : 1) ||
            !Number.isInteger(periodo) || periodo < 1 || periodo > 10 ||
            !Number.isInteger(tiempoRestante) || tiempoRestante < 0 || tiempoRestante > 3600) {
            return res.status(400).json({ status: false, icon: "warning", title: "Datos inválidos", text: "Revise los datos de la estadística" })
        }

        const resInsert = await model.registrarEstadistica({
            id_partido_fk: partidoId,
            id_jugador_fk: jugadorId,
            evento: body.evento,
            valor,
            periodo,
            tiempo_restante: tiempoRestante
        })
        if (!resInsert.affectedRows) return res.status(500).json({ status: false, icon: "error", title: "Error", text: "No se pudo registrar la estadística" })
        return res.json({ status: true, icon: "success", title: "Éxito", text: "Estadística registrada correctamente" })
    } catch (error) {
        const erroresValidacion = [
            "PARTIDO_NO_EXISTE",
            "PARTIDO_NO_EN_CURSO",
            "JUGADOR_NO_CONVOCADO",
            "JUGADOR_EN_BANCO"
        ]
        if (erroresValidacion.includes(error.code)) {
            const status = error.code === "PARTIDO_NO_EXISTE" ? 404 : 400
            return res.status(status).json({ status: false, icon: "warning", title: "No se pudo registrar", text: error.message })
        }
        console.error(error)
        return res.status(500).json({ status: false, icon: "error", title: "Error", text: "No se pudo registrar la estadística" })
    }
}

exports.postDeshacerUltimaAccion = async (req, res) => {
    try {
        const resDelete = await model.deshacerUltimoEvento(req.body.id_partido_fk);
        if (resDelete.affectedRows == 0) {
            return res.json({ status: false, icon: "error", title: "Error", text: "Hubo un error al procesar la solicitud" });
        }
        return res.json({ status: true, icon: "success", title: "Éxito", text: "Última acción deshecha correctamente" });
    } catch (error) {
        console.log(error);
        return res.json({ status: false, icon: "error", title: "Error", text: "Hubo un error al procesar la solicitud" });
    }
}


exports.postObtenerEstadisticas = async (req, res) => {
    try {
        const data = await model.getEventosByPartido(req.body.id);
        if (!data.length) return res.json({ status: false, icon: "warning", title: "Alerta", text: "No existen registros cargados" });
        return res.json({ status: true, data });
    } catch (error) {
        console.error(error);
        return res.json({ status: false, icon: "error", title: "Error", text: "Hubo un error al procesar la solicitud" });
    }
}

const calcularEnCancha = (convocados, sustituciones) => {
    const enCancha = { A: new Set(), B: new Set() }
    for (const jugador of convocados) {
        if (Number(jugador.es_titular) === 1) enCancha[jugador.lado].add(Number(jugador.id_jugador_fk))
    }
    const ladoPorJugador = new Map(convocados.map(jugador => [Number(jugador.id_jugador_fk), jugador.lado]))
    for (const sustitucion of sustituciones) {
        const sale = Number(sustitucion.id_jugador_fk)
        const entra = Number(sustitucion.id_jugador_entrada)
        const lado = ladoPorJugador.get(sale)
        if (lado && ladoPorJugador.get(entra) === lado && enCancha[lado].has(sale)) {
            enCancha[lado].delete(sale)
            enCancha[lado].add(entra)
        }
    }
    return enCancha
}

const aplicarConvocatoriaLegada = data => {
    if (!data.convocados.length && !data.partido.id_torneo_categoria_fk && [1, 2].includes(Number(data.partido.estado))) {
        data.convocados = data.candidatos.map(jugador => ({ ...jugador, es_titular: 1 }))
    }
}

exports.getConvocatoriaAjax = async (req, res) => {
    const partidoId = Number((req.body || {}).id)
    if (!Number.isInteger(partidoId) || partidoId < 1) {
        return res.status(400).json({ status: false, text: "El partido seleccionado es inválido" })
    }
    try {
        const data = await model.getConvocatoriaData(partidoId)
        if (!data) return res.status(404).json({ status: false, text: "El partido solicitado no existe" })
        aplicarConvocatoriaLegada(data)
        const enCancha = calcularEnCancha(data.convocados, data.sustituciones)
        data.enCancha = {
            A: Array.from(enCancha.A),
            B: Array.from(enCancha.B)
        }
        return res.json({ status: true, data })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ status: false, text: "No se pudo cargar la convocatoria del partido" })
    }
}

exports.postGuardarConvocatoria = async (req, res) => {
    const partidoId = Number((req.body || {}).id_partido_fk)
    let seleccion
    try {
        seleccion = JSON.parse((req.body || {}).convocados || "null")
    } catch (error) {
        return res.status(400).json({ status: false, text: "La convocatoria enviada no es válida" })
    }
    if (!Number.isInteger(partidoId) || partidoId < 1 || !Array.isArray(seleccion)) {
        return res.status(400).json({ status: false, text: "La convocatoria enviada no es válida" })
    }
    try {
        const resultado = await model.guardarConvocatoria(partidoId, seleccion)
        await eventos.insertarEvento({ usuario: req.session.user.id, tabla: "Partidos - Convocatoria", acc: "m", registro: partidoId })
        return res.json({
            status: true,
            icon: "success",
            title: "Convocatoria guardada",
            text: `Se guardaron ${resultado.convocados} jugadores convocados`
        })
    } catch (error) {
        console.error(error)
        const erroresValidacion = [
            "PARTIDO_NO_EXISTE",
            "PARTIDO_INICIADO",
            "PARTIDO_CON_EVENTOS",
            "CONVOCATORIA_INVALIDA",
            "TITULARES_INVALIDOS"
        ]
        const status = error.code === "PARTIDO_NO_EXISTE" ? 404 : erroresValidacion.includes(error.code) ? 400 : 500
        return res.status(status).json({
            status: false,
            icon: "error",
            title: "No se pudo guardar la convocatoria",
            text: error.message || "Ocurrió un error al guardar la convocatoria"
        })
    }
}

exports.postRegistrarSustitucion = async (req, res) => {
    const body = req.body || {}
    const partidoId = Number(body.id_partido_fk)
    const saleId = Number(body.id_jugador_sale)
    const entraId = Number(body.id_jugador_entra)
    const periodo = Number(body.periodo)
    const tiempoRestante = Number(body.tiempo_restante)
    if (!Number.isInteger(partidoId) || partidoId < 1 ||
        !Number.isInteger(saleId) || saleId < 1 ||
        !Number.isInteger(entraId) || entraId < 1 || saleId === entraId ||
        !Number.isInteger(periodo) || periodo < 1 || periodo > 10 ||
        !Number.isInteger(tiempoRestante) || tiempoRestante < 0 || tiempoRestante > 3600) {
        return res.status(400).json({ status: false, icon: "warning", title: "Datos inválidos", text: "Revise los datos de la sustitución" })
    }
    try {
        await model.registrarSustitucion(partidoId, saleId, entraId, periodo, tiempoRestante)
        return res.json({ status: true, icon: "success", title: "Cambio registrado", text: "La sustitución se registró correctamente" })
    } catch (error) {
        console.error(error)
        const status = error.code === "PARTIDO_NO_EXISTE" ? 404 :
            error.code && error.code.startsWith("ER_") ? 500 : 400
        return res.status(status).json({
            status: false,
            icon: "error",
            title: "No se pudo registrar el cambio",
            text: error.message || "Ocurrió un error al registrar la sustitución"
        })
    }
}