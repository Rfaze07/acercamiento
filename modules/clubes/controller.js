const model = require("./model")
const eventos = require("../eventos/controller")

const responderError = (res, text, status = 400) => res.status(status).json({
    status: false,
    icon: "error",
    title: "Error",
    text
})

exports.getLista = (req, res) => {
    res.render("clubes/views/index", {
        pagename: "Clubes",
        permisos: req.session.user.permisos
    })
}

exports.getListaAjax = async (req, res) => {
    try {
        const data = await model.getAll((req.body || {}).activo || "t")
        return res.json({ status: true, data })
    } catch (error) {
        console.error(error)
        return responderError(res, "No se pudo cargar la lista de clubes", 500)
    }
}

exports.getListaSelectAjax = async (req, res) => {
    try {
        const data = await model.getAll((req.body || {}).incluirInactivos == 1 ? "t" : "1")
        return res.json({ status: true, data })
    } catch (error) {
        console.error(error)
        return responderError(res, "No se pudieron cargar los clubes", 500)
    }
}

exports.getByIdAjax = async (req, res) => {
    try {
        const data = await model.getById((req.body || {}).id)
        if (!data.length) return responderError(res, "El club solicitado no existe", 404)
        return res.json({ status: true, data: data[0] })
    } catch (error) {
        console.error(error)
        return responderError(res, "No se pudo cargar el club", 500)
    }
}

const validar = body => {
    if (!body || typeof body.nombre !== "string" || !body.nombre.trim()) return "Debe ingresar el nombre del club"
    if (body.nombre.trim().length > 100) return "El nombre no puede superar los 100 caracteres"
    for (const campo of ["localidad", "escudo"]) {
        if (body[campo] != null && typeof body[campo] !== "string") return "La localidad y el escudo deben ser texto"
    }
    if ((body.localidad || "").trim().length > 100) return "La localidad no puede superar los 100 caracteres"
    if ((body.escudo || "").trim().length > 200) return "El enlace del escudo no puede superar los 200 caracteres"
    if (body.activo !== undefined && !["0", "1", 0, 1, true, false].includes(body.activo)) return "El estado del club es inválido"
    return null
}

const guardar = async (req, res, modificar) => {
    const body = req.body || {}
    const errorValidacion = validar(body)
    if (errorValidacion) return responderError(res, errorValidacion)
    const id = Number(body.id)
    if (modificar && (!Number.isInteger(id) || id < 1)) return responderError(res, "El club seleccionado es inválido")

    try {
        if (modificar && !(await model.getById(id)).length) return responderError(res, "El club solicitado no existe", 404)
        const club = {
            id,
            nombre: body.nombre.trim(),
            localidad: (body.localidad || "").trim() || null,
            escudo: (body.escudo || "").trim() || null,
            activo: body.activo === undefined ? 1 : Number(Boolean(Number(body.activo)))
        }
        const result = modificar ? await model.update(club) : await model.insert(club)
        await eventos.insertarEvento({
            usuario: req.session.user.id,
            tabla: "Clubes",
            acc: modificar ? "m" : "a",
            registro: modificar ? id : result.insertId
        })
        return res.json({ status: true, icon: "success", title: "Éxito", text: "Club guardado correctamente" })
    } catch (error) {
        console.error(error)
        if (error.code === "ER_DUP_ENTRY") return responderError(res, "Ya existe un club con ese nombre", 409)
        return responderError(res, "No se pudo guardar el club", 500)
    }
}

exports.postAlta = (req, res) => guardar(req, res, false)
exports.postModificar = (req, res) => guardar(req, res, true)

exports.postEliminar = async (req, res) => {
    const id = Number((req.body || {}).id)
    if (!Number.isInteger(id) || id < 1) return responderError(res, "El club seleccionado es inválido")
    try {
        if (!(await model.getById(id)).length) return responderError(res, "El club solicitado no existe", 404)
        await model.delete(id)
        await eventos.insertarEvento({ usuario: req.session.user.id, tabla: "Clubes", acc: "b", registro: id })
        return res.json({ status: true, icon: "success", title: "Éxito", text: "Club dado de baja correctamente" })
    } catch (error) {
        console.error(error)
        return responderError(res, "No se pudo dar de baja el club", 500)
    }
}
