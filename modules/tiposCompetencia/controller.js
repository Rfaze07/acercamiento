const model = require("./model")
const eventos = require("../eventos/controller")

const responderError = (res, text, status = 400) => res.status(status).json({
    status: false,
    icon: "error",
    title: "Error",
    text
})

exports.getLista = (req, res) => {
    res.render("tiposCompetencia/views/index", {
        pagename: "Tipos de competencia",
        permisos: req.session.user.permisos
    })
}

exports.getListaAjax = async (req, res) => {
    try {
        const data = await model.getAll((req.body || {}).activo || "t")
        return res.json({ status: true, data })
    } catch (error) {
        console.error(error)
        return responderError(res, "No se pudo cargar la lista de tipos de competencia", 500)
    }
}

exports.getListaSelectAjax = async (req, res) => {
    try {
        const data = await model.getAll((req.body || {}).incluirInactivos == 1 ? "t" : "1")
        return res.json({ status: true, data })
    } catch (error) {
        console.error(error)
        return responderError(res, "No se pudieron cargar los tipos de competencia", 500)
    }
}

exports.getByIdAjax = async (req, res) => {
    try {
        const data = await model.getById((req.body || {}).id)
        if (!data.length) return responderError(res, "El tipo de competencia solicitado no existe", 404)
        return res.json({ status: true, data: data[0] })
    } catch (error) {
        console.error(error)
        return responderError(res, "No se pudo cargar el tipo de competencia", 500)
    }
}

const validar = body => {
    if (!body || typeof body.nombre !== "string" || !body.nombre.trim()) return "Debe ingresar el nombre del tipo de competencia"
    if (body.nombre.trim().length > 50) return "El nombre no puede superar los 50 caracteres"
    if (body.descripcion != null && typeof body.descripcion !== "string") return "La descripción debe ser texto"
    if ((body.descripcion || "").trim().length > 200) return "La descripción no puede superar los 200 caracteres"
    if (body.activo !== undefined && !["0", "1", 0, 1, true, false].includes(body.activo)) return "El estado del tipo es inválido"
    return null
}

const guardar = async (req, res, modificar) => {
    const body = req.body || {}
    const errorValidacion = validar(body)
    if (errorValidacion) return responderError(res, errorValidacion)
    const id = Number(body.id)
    if (modificar && (!Number.isInteger(id) || id < 1)) return responderError(res, "El tipo de competencia seleccionado es inválido")

    try {
        if (modificar && !(await model.getById(id)).length) return responderError(res, "El tipo de competencia solicitado no existe", 404)
        const tipo = {
            id,
            nombre: body.nombre.trim(),
            descripcion: (body.descripcion || "").trim() || null,
            activo: body.activo === undefined ? 1 : Number(Boolean(Number(body.activo)))
        }
        const result = modificar ? await model.update(tipo) : await model.insert(tipo)
        await eventos.insertarEvento({
            usuario: req.session.user.id,
            tabla: "Tipos de competencia",
            acc: modificar ? "m" : "a",
            registro: modificar ? id : result.insertId
        })
        return res.json({ status: true, icon: "success", title: "Éxito", text: "Tipo de competencia guardado correctamente" })
    } catch (error) {
        console.error(error)
        if (error.code === "ER_DUP_ENTRY") return responderError(res, "Ya existe un tipo de competencia con ese nombre", 409)
        return responderError(res, "No se pudo guardar el tipo de competencia", 500)
    }
}

exports.postAlta = (req, res) => guardar(req, res, false)
exports.postModificar = (req, res) => guardar(req, res, true)

exports.postEliminar = async (req, res) => {
    const id = Number((req.body || {}).id)
    if (!Number.isInteger(id) || id < 1) return responderError(res, "El tipo de competencia seleccionado es inválido")
    try {
        if (!(await model.getById(id)).length) return responderError(res, "El tipo de competencia solicitado no existe", 404)
        await model.delete(id)
        await eventos.insertarEvento({ usuario: req.session.user.id, tabla: "Tipos de competencia", acc: "b", registro: id })
        return res.json({ status: true, icon: "success", title: "Éxito", text: "Tipo de competencia dado de baja correctamente" })
    } catch (error) {
        console.error(error)
        return responderError(res, "No se pudo dar de baja el tipo de competencia", 500)
    }
}
