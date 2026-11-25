const model = require('./model')
const utils = require('../../utils')
const eventos = require("../eventos/controller")
const equipos = require("../equipos/model")


exports.getLista = async (req, res) => {
    try {
        res.render('jugadores/views/index', {
            pagename: "Jugadores",
            permisos: req.session.user.permisos
        })
    } catch (error) {
        console.log(error)
        res.redirect('/inicio')
    }
}

exports.getListaAjax = async (req, res) => {
    try {
        const data = await model.getLista(req.body || {})

        if(!data.length) return res.json({ status: false, icon:"warning", title: "Alerta", text: "No existen registros cargados" })
        return res.json({ status: true, data })
    } catch (error) {
        console.error(error)
        return res.json({ status: false, icon:"error", title: "Error", text: "No se pudo cargar la lista de jugadores" })
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

exports.getByEquipo = async (req, res) => {
    try {
        const { equipo_id } = req.body
        if(!Number.isInteger(Number(equipo_id)) || Number(equipo_id) < 1){
            return res.json({ status:false, icon:"warning", title:"Alerta", text:"El equipo seleccionado es inválido" })
        }
        const data = await model.execQuery(
            'SELECT * FROM jugadores WHERE id_equipo_fk = ? AND activo = 1 ORDER BY dorsal, nombre',
            [Number(equipo_id)]
        )
        if(!data.length) return res.json({ status: false, icon:"warning", title: "Alerta", text: "No existen jugadores cargados para este equipo" })
        return res.json({ status: true, data })
    } catch (error) {
        console.log(error)
        return res.json({ status: false, icon: "error", title: "Error", text: "Hubo un error al procesar la solicitud" })
    }
}

exports.postAlta = async (req, res) => {
    try {
        const validaciones = await ValidarCampos(req.body)
        if(!validaciones.status) return res.json(validaciones)

        if(req.body.id_equipo_fk && !(await equipos.getById(req.body.id_equipo_fk)).length){
            return res.json({ status:false, icon:'error', title:'Error', text:'El equipo seleccionado no existe' })
        }
        let resInsert = await model.insert(req.body)
        if(!resInsert.affectedRows) return res.json({ status: false, icon:"error", title: "Error", text: "Hubo un error al procesar la solicitud" })
        await eventos.insertarEvento({ usuario: req.session.user.id, tabla: "Jugadores", acc: "a", registro: resInsert.insertId })
        res.json({ status: true, icon:"success", title: "Éxito", text: "Solicitud procesada correctamente" })
    } catch (error) {
        console.error(error)
        return res.json({ status: false, icon:'error', title: "Error", text: "Hubo un error al procesar la solicitud" })
    }
}

exports.getById = async (req, res) => {    
    try {
        const data = await model.getById(req.body.id)
        if(!data.length) return res.json({ status: false, icon:'error', title: "Error", text: "No existen registros cargados" })
        return res.json({ status: true, data: data[0] })
    } catch (error) {
        console.error(error)
        return res.json({ status:false, icon:"error", title:"Error", text:"No se pudo cargar el jugador" })
    }
}

exports.postModificar = async (req, res) => {
    try {
        const validaciones = await ValidarCampos(req.body)
        if(!validaciones.status) return res.json(validaciones)
        if(!Number.isInteger(Number(req.body.id)) || Number(req.body.id) < 1) return res.json({ status:false, icon:'error', title:'Error', text:'El jugador seleccionado es inválido' })
        if(!(await model.getById(req.body.id)).length) return res.json({ status:false, icon:"error", title:"Error", text:"El jugador no existe" })
        if(req.body.id_equipo_fk && !(await equipos.getById(req.body.id_equipo_fk)).length){
            return res.json({ status:false, icon:'error', title:'Error', text:'El equipo seleccionado no existe' })
        }

        let result = await model.update(req.body)
        if(result.affectedRows == 0 && !(await model.getById(req.body.id)).length) return res.json({ status: false, icon:'error', title: "Error", text: "El jugador no existe" })
        await eventos.insertarEvento({ usuario: req.session.user.id, tabla: "Jugadores", acc: "m", registro: req.body.id })
        return res.json({ status: true, icon: "success", title: "Éxito", text: "Solicitud procesada correctamente" })
    } catch (error) {
        console.log(error)
        return res.json({ status: false, icon: "error", title: "Error", text: "Hubo un error al procesar la solicitud" })
    }
}

exports.postEliminar = async (req, res) => {
    try {
        if(!Number.isInteger(Number(req.body.id)) || Number(req.body.id) < 1) return res.json({ status:false, icon:'error', title:'Error', text:'El jugador seleccionado es inválido' })
        if(!(await model.getById(req.body.id)).length) return res.json({ status:false, icon:"error", title:"Error", text:"El jugador no existe" })
        let result = await model.delete(req.body.id)
        if(result.affectedRows == 0) return res.json({ status: false, icon: "error", title: "Error", text: "No se pudo dar de baja el jugador" })
        await eventos.insertarEvento({ usuario: req.session.user.id, tabla: "Jugadores", acc: "b", registro: req.body.id })
        return res.json({ status: true, icon: "success", title: "Éxito", text: "Jugador dado de baja correctamente" })
    } catch (error) {
        console.log(error)
        return res.json({ status: false, icon: "error", title: "Error", text: "Hubo un error al procesar la solicitud" })
    }
}

const ValidarCampos = o => {
    return new Promise((resolve, reject) => {
        if(!o || typeof o.nombre !== 'string' || o.nombre.trim().length == 0) return resolve({ status: false, icon:'error', title:'Error', text:'Debe ingresar el nombre del jugador' })
        if(o.nombre.trim().length > 40) return resolve({ status: false, icon:'error', title:'Error', text:'El nombre superó la cantidad permitida' })
        if(o.id_equipo_fk === '') o.id_equipo_fk = null
        if(o.id_equipo_fk != null && (!Number.isInteger(Number(o.id_equipo_fk)) || Number(o.id_equipo_fk) < 1)) return resolve({ status:false, icon:'error', title:'Error', text:'El equipo seleccionado es inválido' })
        if(o.dorsal === '' || o.dorsal == null) o.dorsal = 0
        if(!Number.isInteger(Number(o.dorsal)) || Number(o.dorsal) < 0 || Number(o.dorsal) > 99) return resolve({ status:false, icon:'error', title:'Error', text:'El dorsal histórico debe ser un entero entre 0 y 99' })
        o.id_equipo_fk = o.id_equipo_fk == null ? null : Number(o.id_equipo_fk)
        o.dorsal = Number(o.dorsal)
        o.activo = utils.changeToBoolean(o.activo)
        return resolve({ status: true })
    })
}