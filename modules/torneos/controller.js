const model = require("./model")
const tiposCompetencia = require("../tiposCompetencia/model")
const eventos = require("../eventos/controller")

const estadosValidos = ["planificacion", "inscripcion", "en_curso", "finalizado", "cancelado"]
const responderError = (res, text, status = 400) => res.status(status).json({
    status: false,
    icon: "error",
    title: "Error",
    text
})

exports.getLista = (req, res) => {
    res.render("torneos/views/index", {
        pagename: "Torneos",
        permisos: req.session.user.permisos
    })
}

exports.getListaAjax = async (req, res) => {
    try {
        const filtros = req.body || {}
        const data = await model.getAll({
            activo: filtros.activo || "t",
            tipo: filtros.tipo || "t",
            estado: filtros.estado || "t"
        })
        return res.json({ status: true, data })
    } catch (error) {
        console.error(error)
        return responderError(res, "No se pudo cargar la lista de torneos", 500)
    }
}

exports.getByIdAjax = async (req, res) => {
    try {
        const data = await model.getById((req.body || {}).id)
        if (!data.length) return responderError(res, "El torneo solicitado no existe", 404)
        return res.json({ status: true, data: data[0] })
    } catch (error) {
        console.error(error)
        return responderError(res, "No se pudo cargar el torneo", 500)
    }
}

const fechaValida = fecha => {
    if (!fecha) return true
    if (typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false
    const [anio, mes, dia] = fecha.split("-").map(Number)
    const valor = new Date(Date.UTC(anio, mes - 1, dia))
    return anio >= 1000 &&
        valor.getUTCFullYear() === anio &&
        valor.getUTCMonth() === mes - 1 &&
        valor.getUTCDate() === dia
}

const validar = body => {
    if (!body) return { error: "Los datos del torneo son obligatorios" }
    const nombre = typeof body.nombre === "string" ? body.nombre.trim() : ""
    const temporada = body.temporada == null ? "" : typeof body.temporada === "string" ? body.temporada.trim() : null
    const descripcion = body.descripcion == null ? "" : typeof body.descripcion === "string" ? body.descripcion.trim() : null
    const tipo = Number(body.id_tipo_competencia_fk)
    if (!Number.isInteger(tipo) || tipo < 1) return { error: "Seleccione un tipo de competencia válido" }
    if (!nombre) return { error: "Debe ingresar el nombre del torneo" }
    if (nombre.length > 120) return { error: "El nombre no puede superar los 120 caracteres" }
    if (temporada === null || temporada.length > 20) return { error: "La temporada debe tener hasta 20 caracteres" }
    if (descripcion === null) return { error: "La descripción debe ser texto" }
    if (!estadosValidos.includes(body.estado)) return { error: "El estado seleccionado no es válido" }

    const fechaInicio = body.fecha_inicio || null
    const fechaFin = body.fecha_fin || null
    if (!fechaValida(fechaInicio) || !fechaValida(fechaFin)) return { error: "Ingrese fechas válidas" }
    if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
        return { error: "La fecha de finalización no puede ser anterior a la fecha de inicio" }
    }
    if (body.activo !== undefined && !["0", "1", 0, 1, true, false].includes(body.activo)) {
        return { error: "El estado activo del torneo es inválido" }
    }
    return {
        torneo: {
            id_tipo_competencia_fk: tipo,
            nombre,
            temporada: temporada || null,
            descripcion: descripcion || null,
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin,
            estado: body.estado,
            activo: body.activo === undefined ? 1 : Number(Boolean(Number(body.activo)))
        }
    }
}

const guardar = async (req, res, modificar) => {
    const body = req.body || {}
    const resultado = validar(body)
    if (resultado.error) return responderError(res, resultado.error)
    const id = Number(body.id)
    if (modificar && (!Number.isInteger(id) || id < 1)) return responderError(res, "El torneo seleccionado es inválido")

    try {
        const tipo = await tiposCompetencia.getById(resultado.torneo.id_tipo_competencia_fk)
        if (!tipo.length) return responderError(res, "El tipo de competencia seleccionado no existe", 404)
        if (!modificar && tipo[0].activo !== 1) return responderError(res, "Seleccione un tipo de competencia activo")
        if (modificar && !(await model.getById(id)).length) return responderError(res, "El torneo solicitado no existe", 404)

        resultado.torneo.id = id
        const result = modificar ? await model.update(resultado.torneo) : await model.insert(resultado.torneo)
        await eventos.insertarEvento({
            usuario: req.session.user.id,
            tabla: "Torneos",
            acc: modificar ? "m" : "a",
            registro: modificar ? id : result.insertId
        })
        return res.json({ status: true, icon: "success", title: "Éxito", text: "Torneo guardado correctamente" })
    } catch (error) {
        console.error(error)
        return responderError(res, "No se pudo guardar el torneo", 500)
    }
}

exports.postAlta = (req, res) => guardar(req, res, false)
exports.postModificar = (req, res) => guardar(req, res, true)

exports.postEliminar = async (req, res) => {
    const id = Number((req.body || {}).id)
    if (!Number.isInteger(id) || id < 1) return responderError(res, "El torneo seleccionado es inválido")
    try {
        if (!(await model.getById(id)).length) return responderError(res, "El torneo solicitado no existe", 404)
        await model.delete(id)
        await eventos.insertarEvento({ usuario: req.session.user.id, tabla: "Torneos", acc: "b", registro: id })
        return res.json({ status: true, icon: "success", title: "Éxito", text: "Torneo dado de baja correctamente" })
    } catch (error) {
        console.error(error)
        return responderError(res, "No se pudo dar de baja el torneo", 500)
    }
}

const numeroOrganizacion = (valor, minimo, maximo, opcional = false) => {
    if (opcional && (valor === "" || valor == null)) return null
    const numero = Number(valor)
    if (!Number.isInteger(numero) || numero < minimo || numero > maximo) return undefined
    return numero
}

const textoOrganizacion = (valor, maximo, opcional = false) => {
    if (valor == null && opcional) return { valor: null }
    if (typeof valor !== "string") return { error: "El texto ingresado no es válido" }
    const texto = valor.trim()
    if (!texto && !opcional) return { error: "Complete los campos obligatorios" }
    if (texto.length > maximo) return { error: `El texto no puede superar los ${maximo} caracteres` }
    return { valor: texto || null }
}

const fechaOrganizacion = valor => {
    if (valor === "" || valor == null) return null
    return fechaValida(valor) ? valor : undefined
}

exports.getOrganizacion = async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) return res.status(404).render("error_permiso", {
        pagename: "Torneos",
        ip: req.ip.replace(/^.*:/, ""),
        error: "El torneo solicitado no existe."
    })
    try {
        const torneo = await model.getById(id)
        if (!torneo.length) return res.status(404).render("error_permiso", {
            pagename: "Torneos",
            ip: req.ip.replace(/^.*:/, ""),
            error: "El torneo solicitado no existe."
        })
        return res.render("torneos/views/organizacion", {
            pagename: "Organización del torneo",
            torneo: torneo[0],
            permisos: req.session.user.permisos
        })
    } catch (error) {
        console.error(error)
        return res.status(500).render("error_permiso", {
            pagename: "Torneos",
            ip: req.ip.replace(/^.*:/, ""),
            error: "No se pudo cargar la organización del torneo."
        })
    }
}

exports.getOrganizacionAjax = async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id < 1) return responderError(res, "El torneo seleccionado es inválido")
    try {
        if (!(await model.getById(id)).length) return responderError(res, "El torneo solicitado no existe", 404)
        const data = await model.getOrganizacion(id)
        return res.json({ status: true, data })
    } catch (error) {
        console.error(error)
        return responderError(res, "No se pudo cargar la organización del torneo", 500)
    }
}

exports.organizacionAction = async (req, res) => {
    const torneoId = Number(req.params.id)
    const { entidad, accion } = req.params
    const body = req.body || {}
    if (!Number.isInteger(torneoId) || torneoId < 1) return responderError(res, "El torneo seleccionado es inválido")

    try {
        if (!(await model.getById(torneoId)).length) return responderError(res, "El torneo solicitado no existe", 404)
        let registro
        let tabla

        if (entidad === "categoria") {
            tabla = "Torneos - Categorías"
            if (accion === "alta" || accion === "modificar") {
                const nombre = textoOrganizacion(body.nombre, 60)
                const observaciones = textoOrganizacion(body.observaciones || "", 500, true)
                const rama = body.rama
                const formato = body.formato
                const desde = numeroOrganizacion(body.edad_desde, 0, 120, true)
                const hasta = numeroOrganizacion(body.edad_hasta, 0, 120, true)
                const orden = numeroOrganizacion(body.orden, 0, 100000)
                if (nombre.error || observaciones.error || desde === undefined || hasta === undefined ||
                    orden === undefined || !["masculina", "femenina", "mixta", "no_aplica"].includes(rama) ||
                    !["liga", "grupos", "eliminacion", "amistoso", "personalizado"].includes(formato)) {
                    return responderError(res, nombre.error || observaciones.error || "Revise los datos de la categoría")
                }
                if (desde != null && hasta != null && desde > hasta) return responderError(res, "La edad desde no puede superar la edad hasta")
                const categoria = {
                    id_torneo_fk: torneoId,
                    nombre: nombre.valor,
                    rama,
                    edad_desde: desde,
                    edad_hasta: hasta,
                    formato,
                    orden,
                    observaciones: observaciones.valor
                }
                if (accion === "alta") {
                    const existente = await model.getCategoriaByNombre(torneoId, nombre.valor, rama)
                    if (existente.length) {
                        if (existente[0].activo) return responderError(res, "Ya existe una categoría con ese nombre y rama")
                        categoria.id = existente[0].id
                        const resultado = await model.reactivarCategoria(categoria)
                        if (!resultado.affectedRows) return responderError(res, "No se pudo reactivar la categoría")
                        registro = existente[0].id
                    } else {
                        const resultado = await model.insertCategoria(categoria)
                        registro = resultado.insertId
                    }
                } else {
                    const id = numeroOrganizacion(body.id, 1, Number.MAX_SAFE_INTEGER)
                    if (id === undefined) return responderError(res, "La categoría seleccionada es inválida")
                    if (!(await model.getCategoria(id, torneoId)).length) return responderError(res, "La categoría no existe en este torneo", 404)
                    categoria.id = id
                    await model.updateCategoria(categoria)
                    registro = id
                }
            } else if (accion === "eliminar") {
                registro = numeroOrganizacion(body.id, 1, Number.MAX_SAFE_INTEGER)
                if (registro === undefined) return responderError(res, "La categoría seleccionada es inválida")
                const resultado = await model.deleteCategoria(registro, torneoId)
                if (!resultado.affectedRows) return responderError(res, "La categoría no existe en este torneo", 404)
            }
        } else if (entidad === "inscripcion") {
            tabla = "Torneos - Inscripciones"
            if (accion === "alta" || accion === "modificar") {
                const nombre = textoOrganizacion(body.nombre_inscripcion || "", 80, true)
                const observaciones = textoOrganizacion(body.observaciones || "", 500, true)
                const estado = body.estado || "confirmado"
                if (nombre.error || observaciones.error ||
                    !["pendiente", "confirmado", "rechazado"].includes(estado)) {
                    return responderError(res, nombre.error || observaciones.error || "El estado de inscripción no es válido")
                }
                const inscripcion = {
                    id_torneo_fk: torneoId,
                    nombre_inscripcion: nombre.valor,
                    estado,
                    observaciones: observaciones.valor
                }
                if (accion === "alta") {
                    const categoriaId = numeroOrganizacion(body.id_torneo_categoria_fk, 1, Number.MAX_SAFE_INTEGER)
                    const equipoId = numeroOrganizacion(body.id_equipo_fk, 1, Number.MAX_SAFE_INTEGER)
                    if (categoriaId === undefined || equipoId === undefined) return responderError(res, "Seleccione una categoría y un equipo válidos")
                    inscripcion.id_torneo_categoria_fk = categoriaId
                    inscripcion.id_equipo_fk = equipoId
                    if (!(await model.getCategoria(categoriaId, torneoId)).length) return responderError(res, "La categoría seleccionada no existe en este torneo", 404)
                    if (!(await model.getEquipo(equipoId)).length) return responderError(res, "El equipo seleccionado no existe o está inactivo", 404)
                    const existente = await model.getInscripcionByPair(categoriaId, equipoId)
                    if (existente.length) {
                        if (existente[0].activo) return responderError(res, "Ese equipo ya está inscripto en la categoría")
                        inscripcion.id = existente[0].id
                        const resultado = await model.reactivarInscripcion(inscripcion)
                        if (!resultado.affectedRows) return responderError(res, "La categoría seleccionada no existe en este torneo", 404)
                        registro = existente[0].id
                    } else {
                        const resultado = await model.insertInscripcion(inscripcion)
                        if (!resultado.affectedRows) return responderError(res, "La categoría o el equipo seleccionado no está disponible")
                        registro = resultado.insertId
                    }
                } else {
                    const id = numeroOrganizacion(body.id, 1, Number.MAX_SAFE_INTEGER)
                    if (id === undefined) return responderError(res, "La inscripción seleccionada es inválida")
                    if (!(await model.getInscripcion(id, torneoId)).length) return responderError(res, "La inscripción no existe en este torneo", 404)
                    inscripcion.id = id
                    await model.updateInscripcion(inscripcion)
                    registro = id
                }
            } else if (accion === "eliminar") {
                registro = numeroOrganizacion(body.id, 1, Number.MAX_SAFE_INTEGER)
                if (registro === undefined) return responderError(res, "La inscripción seleccionada es inválida")
                const resultado = await model.deleteInscripcion(registro, torneoId)
                if (!resultado.affectedRows) return responderError(res, "La inscripción no existe en este torneo", 404)
            }
        } else if (entidad === "plantel") {
            tabla = "Torneos - Planteles"
            if (accion === "alta" || accion === "modificar") {
                const dorsal = numeroOrganizacion(body.dorsal, 0, 99, true)
                const fechaAlta = fechaOrganizacion(body.fecha_alta)
                const fechaBaja = fechaOrganizacion(body.fecha_baja)
                const estado = body.estado || "activo"
                const observaciones = textoOrganizacion(body.observaciones || "", 500, true)
                if (dorsal === undefined || fechaAlta === undefined || fechaBaja === undefined ||
                    observaciones.error || !["activo", "baja", "suspendido"].includes(estado)) {
                    return responderError(res, observaciones.error || "Revise dorsal, fechas y estado del jugador")
                }
                if (fechaAlta && fechaBaja && fechaBaja < fechaAlta) return responderError(res, "La fecha de baja no puede ser anterior al alta")
                const plantel = {
                    id_torneo_fk: torneoId,
                    dorsal,
                    fecha_alta: fechaAlta,
                    fecha_baja: fechaBaja,
                    estado,
                    observaciones: observaciones.valor
                }
                if (accion === "alta") {
                    const inscripcionId = numeroOrganizacion(body.id_torneo_equipo_fk, 1, Number.MAX_SAFE_INTEGER)
                    const jugadorId = numeroOrganizacion(body.id_jugador_fk, 1, Number.MAX_SAFE_INTEGER)
                    if (inscripcionId === undefined || jugadorId === undefined) return responderError(res, "Seleccione una inscripción y un jugador válidos")
                    plantel.id_torneo_equipo_fk = inscripcionId
                    plantel.id_jugador_fk = jugadorId
                    if (!(await model.getInscripcion(inscripcionId, torneoId)).length) return responderError(res, "La inscripción no existe en este torneo", 404)
                    if (!(await model.getJugador(jugadorId)).length) return responderError(res, "El jugador seleccionado no existe o está inactivo", 404)
                    const existente = await model.getJugadorPlantelByPair(inscripcionId, jugadorId)
                    const plantelExistenteId = existente.length ? existente[0].id : null
                    if (existente.length && existente[0].estado !== "baja") return responderError(res, "El jugador ya forma parte de este plantel")
                    if (dorsal != null && (await model.getDorsalConflict(inscripcionId, dorsal, jugadorId, plantelExistenteId)).length) {
                        return responderError(res, "Ese dorsal ya está asignado en este plantel")
                    }
                    if (existente.length) {
                        plantel.id = plantelExistenteId
                        await model.reactivarJugadorPlantel(plantel)
                        registro = plantelExistenteId
                    } else {
                        const resultado = await model.insertJugadorPlantel(plantel)
                        if (!resultado.affectedRows) return responderError(res, "No se pudo agregar al jugador a esta inscripción")
                        registro = resultado.insertId
                    }
                } else {
                    const id = numeroOrganizacion(body.id, 1, Number.MAX_SAFE_INTEGER)
                    if (id === undefined) return responderError(res, "El jugador del plantel seleccionado es inválido")
                    const existente = await model.getPlantelEntry(id, torneoId)
                    if (!existente.length) return responderError(res, "El jugador no pertenece a un plantel de este torneo", 404)
                    if (dorsal != null && (await model.getDorsalConflict(existente[0].id_torneo_equipo_fk, dorsal, existente[0].id_jugador_fk, id)).length) {
                        return responderError(res, "Ese dorsal ya está asignado en este plantel")
                    }
                    plantel.id = id
                    await model.updateJugadorPlantel(plantel)
                    registro = id
                }
            } else if (accion === "eliminar") {
                registro = numeroOrganizacion(body.id, 1, Number.MAX_SAFE_INTEGER)
                if (registro === undefined) return responderError(res, "El jugador del plantel seleccionado es inválido")
                if (!(await model.getPlantelEntry(registro, torneoId)).length) return responderError(res, "El jugador no pertenece a un plantel de este torneo", 404)
                await model.deleteJugadorPlantel(registro, torneoId)
            }
        } else if (entidad === "fase") {
            tabla = "Torneos - Fases"
            if (accion === "alta" || accion === "modificar") {
                const nombre = textoOrganizacion(body.nombre, 100)
                const categoriaId = numeroOrganizacion(body.id_torneo_categoria_fk, 1, Number.MAX_SAFE_INTEGER)
                const tipo = body.tipo
                const formato = body.formato
                const orden = numeroOrganizacion(body.orden, 1, 100000)
                const ruedas = numeroOrganizacion(body.cantidad_ruedas, 1, 255)
                if (nombre.error || categoriaId === undefined || orden === undefined || ruedas === undefined ||
                    !["regular", "grupos", "eliminacion", "playoff", "final", "amistoso", "personalizada"].includes(tipo) ||
                    !["liga", "grupos", "eliminacion", "amistoso", "personalizado"].includes(formato)) {
                    return responderError(res, nombre.error || "Revise los datos de la fase")
                }
                const fase = { id_torneo_fk: torneoId, id_torneo_categoria_fk: categoriaId, nombre: nombre.valor, tipo, formato, orden, cantidad_ruedas: ruedas }
                if (accion === "alta") {
                    const resultado = await model.insertFase(fase)
                    if (!resultado.affectedRows) return responderError(res, "La categoría seleccionada no existe en este torneo", 404)
                    registro = resultado.insertId
                } else {
                    const id = numeroOrganizacion(body.id, 1, Number.MAX_SAFE_INTEGER)
                    if (id === undefined) return responderError(res, "La fase seleccionada es inválida")
                    const existente = await model.getFase(id, torneoId)
                    if (!existente.length) return responderError(res, "La fase no existe en este torneo", 404)
                    if (!(await model.getCategoria(categoriaId, torneoId)).length) return responderError(res, "La categoría seleccionada no existe en este torneo", 404)
                    fase.id = id
                    const resultado = await model.updateFase(fase)
                    const sinCambios = Number(existente[0].id_torneo_categoria_fk) === categoriaId &&
                        existente[0].nombre === fase.nombre && existente[0].tipo === fase.tipo &&
                        existente[0].formato === fase.formato && Number(existente[0].orden) === orden &&
                        Number(existente[0].cantidad_ruedas) === ruedas
                    if (!resultado.affectedRows && !sinCambios) return responderError(res, "No se puede cambiar la categoría porque la fase tiene equipos asignados en otra categoría")
                    registro = id
                }
            } else if (accion === "eliminar") {
                registro = numeroOrganizacion(body.id, 1, Number.MAX_SAFE_INTEGER)
                if (registro === undefined) return responderError(res, "La fase seleccionada es inválida")
                const resultado = await model.deleteFase(registro, torneoId)
                if (!resultado.affectedRows) return responderError(res, "La fase no existe en este torneo", 404)
            }
        } else if (entidad === "grupo") {
            tabla = "Torneos - Grupos"
            if (accion === "alta" || accion === "modificar") {
                const nombre = textoOrganizacion(body.nombre, 60)
                const faseId = numeroOrganizacion(body.id_fase_fk, 1, Number.MAX_SAFE_INTEGER)
                const orden = numeroOrganizacion(body.orden, 0, 100000)
                if (nombre.error || faseId === undefined || orden === undefined) return responderError(res, nombre.error || "Revise los datos del grupo")
                const grupo = { id_torneo_fk: torneoId, id_fase_fk: faseId, nombre: nombre.valor, orden }
                if (accion === "alta") {
                    if (!(await model.getFase(faseId, torneoId)).length) return responderError(res, "La fase seleccionada no existe en este torneo", 404)
                    const existente = await model.getGrupoByNombre(faseId, nombre.valor)
                    if (existente.length) {
                        if (existente[0].activo) return responderError(res, "Ya existe un grupo con ese nombre en la fase")
                        grupo.id = existente[0].id
                        const resultado = await model.reactivarGrupo(grupo)
                        if (!resultado.affectedRows) return responderError(res, "La fase seleccionada no existe en este torneo", 404)
                        registro = existente[0].id
                    } else {
                        const resultado = await model.insertGrupo(grupo)
                        if (!resultado.affectedRows) return responderError(res, "La fase seleccionada no existe en este torneo", 404)
                        registro = resultado.insertId
                    }
                } else {
                    const id = numeroOrganizacion(body.id, 1, Number.MAX_SAFE_INTEGER)
                    if (id === undefined) return responderError(res, "El grupo seleccionado es inválido")
                    const existente = await model.getGrupo(id, torneoId)
                    if (!existente.length) return responderError(res, "El grupo no existe en este torneo", 404)
                    if (!(await model.getFase(faseId, torneoId)).length) return responderError(res, "La fase seleccionada no existe en este torneo", 404)
                    grupo.id = id
                    const resultado = await model.updateGrupo(grupo)
                    const sinCambios = Number(existente[0].id_fase_fk) === faseId &&
                        existente[0].nombre === grupo.nombre && Number(existente[0].orden) === orden
                    if (!resultado.affectedRows && !sinCambios) return responderError(res, "No se puede cambiar la fase porque el grupo tiene equipos de otra categoría")
                    registro = id
                }
            } else if (accion === "eliminar") {
                registro = numeroOrganizacion(body.id, 1, Number.MAX_SAFE_INTEGER)
                if (registro === undefined) return responderError(res, "El grupo seleccionado es inválido")
                const resultado = await model.deleteGrupo(registro, torneoId)
                if (!resultado.affectedRows) return responderError(res, "El grupo no existe en este torneo", 404)
            }
        } else if (entidad === "grupoEquipo") {
            tabla = "Torneos - Equipos por grupo"
            if (accion === "alta") {
                const grupoId = numeroOrganizacion(body.id_grupo_fk, 1, Number.MAX_SAFE_INTEGER)
                const inscripcionId = numeroOrganizacion(body.id_torneo_equipo_fk, 1, Number.MAX_SAFE_INTEGER)
                const orden = numeroOrganizacion(body.orden, 0, 100000)
                if (grupoId === undefined || inscripcionId === undefined || orden === undefined) return responderError(res, "Seleccione un grupo y una inscripción válidos")
                if (!(await model.getGrupoAndInscripcion(grupoId, inscripcionId, torneoId)).length) {
                    return responderError(res, "El equipo inscripto y el grupo deben pertenecer a la misma categoría")
                }
                const existente = await model.getGrupoInscripcionPair(grupoId, inscripcionId)
                if (existente.length) {
                    if (existente[0].activo) return responderError(res, "Ese equipo ya está asignado al grupo")
                    await model.reactivarGrupoEquipo(grupoId, inscripcionId, orden)
                    registro = existente[0].id
                } else {
                    const resultado = await model.insertGrupoEquipo(grupoId, inscripcionId, orden, torneoId)
                    if (!resultado.affectedRows) return responderError(res, "No se pudo asignar el equipo al grupo")
                    registro = resultado.insertId
                }
            } else if (accion === "eliminar") {
                registro = numeroOrganizacion(body.id, 1, Number.MAX_SAFE_INTEGER)
                if (registro === undefined) return responderError(res, "La asignación seleccionada es inválida")
                const resultado = await model.deleteGrupoEquipo(registro, torneoId)
                if (!resultado.affectedRows) return responderError(res, "La asignación no existe en este torneo", 404)
            }
        }

        if (!tabla || !registro) return responderError(res, "La acción de organización no es válida", 404)
        const acc = accion === "alta" ? "a" : accion === "eliminar" ? "b" : "m"
        await eventos.insertarEvento({ usuario: req.session.user.id, tabla, acc, registro })
        return res.json({ status: true, icon: "success", title: "Éxito", text: "Los datos del torneo se guardaron correctamente" })
    } catch (error) {
        console.error(error)
        if (error.code === "ER_DUP_ENTRY") return responderError(res, "Ya existe un registro con esos datos", 409)
        return responderError(res, "No se pudo guardar la organización del torneo", 500)
    }
}
