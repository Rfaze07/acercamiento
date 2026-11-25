const model = require('./model')
const utils = require('../../utils')
const eventos = require("../eventos/controller")
const clubes = require("../clubes/model")


exports.getLista = async (req, res) => {
    try {
        res.render('equipos/views/index', {
            pagename: "Equipos",
            permisos: req.session.user.permisos
        })
    } catch (error) {
        console.log(error)
        res.redirect('/inicio')
    }
}

exports.getListaAjax = async (req, res) => {
    try {
        let params=[], 
            query = `
                SELECT e.*, c.nombre AS club
                FROM equipos e
                LEFT JOIN clubes c ON c.id = e.id_club_fk
                WHERE 1=1
        `

        if(req.body.activo != null && req.body.activo !== '' && req.body.activo != 't'){
            query += ' AND e.activo = ?'
            params.push(req.body.activo)
        }

        if(req.body.club === 'sin_club'){
            query += ' AND e.id_club_fk IS NULL'
        }else if(req.body.club && req.body.club != 't'){
            query += ' AND e.id_club_fk = ?'
            params.push(req.body.club)
        }

        query += 'ORDER BY e.nombre'

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
        const data = req.body.incluirInactivos == 1
            ? await model.getAll()
            : await model.getAllbyActivo(1)
        if(!data.length) return res.json({ status: false, icon:"warning", title: "Alerta", text: "No existen equipos cargados" })
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

        if(req.body.id_club_fk && !(await clubes.getById(req.body.id_club_fk)).length){
            return res.json({ status: false, icon:'error', title:'Error', text:'El club seleccionado no existe' })
        }
        let resInsert = await model.insert(req.body)
        if(!resInsert.affectedRows) return res.json({ status: false, icon:"error", title: "Error", text: "Hubo un error al procesar la solicitud" })
        await eventos.insertarEvento({ usuario: req.session.user.id, tabla: "Equipos", acc: "a", registro: resInsert.insertId })
        res.json({ status: true, icon:"success", title: "Éxito", text: "Solicitud procesada correctamente" })
    } catch (error) {
        console.log(error)
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
        return res.json({ status: false, icon:'error', title:'Error', text:'No se pudo cargar el equipo' })
    }
}

exports.postModificar = async (req, res) => {
    try {
        const validaciones = await ValidarCampos(req.body)
        if(!validaciones.status) return res.json(validaciones)

        if(!Number.isInteger(Number(req.body.id)) || Number(req.body.id) < 1) return res.json({ status:false, icon:'error', title:'Error', text:'El equipo seleccionado es inválido' })
        if(!(await model.getById(req.body.id)).length) return res.json({ status:false, icon:'error', title:'Error', text:'El equipo no existe' })
        if(req.body.id_club_fk && !(await clubes.getById(req.body.id_club_fk)).length){
            return res.json({ status: false, icon:'error', title:'Error', text:'El club seleccionado no existe' })
        }
        let result = await model.update(req.body)
        if(result.affectedRows == 0 && !(await model.getById(req.body.id)).length) return res.json({ status: false, icon:'error', title: "Error", text: "El equipo no existe" })
        await eventos.insertarEvento({ usuario: req.session.user.id, tabla: "Equipos", acc: "m", registro: req.body.id })
        return res.json({ status: true, icon: "success", title: "Éxito", text: "Solicitud procesada correctamente" })
    } catch (error) {
        console.log(error)
        return res.json({ status: false, icon: "error", title: "Error", text: "Hubo un error al procesar la solicitud" })
    }
}

exports.postEliminar = async (req, res) => {
    try {
        if(!Number.isInteger(Number(req.body.id)) || Number(req.body.id) < 1) return res.json({ status:false, icon:'error', title:'Error', text:'El equipo seleccionado es inválido' })
        if(!(await model.getById(req.body.id)).length) return res.json({ status:false, icon:'error', title:'Error', text:'El equipo no existe' })
        let result = await model.delete(req.body.id)
        if(result.affectedRows == 0) return res.json({ status: false, icon: "error", title: "Error", text: "No se pudo dar de baja el equipo" })
        await eventos.insertarEvento({ usuario: req.session.user.id, tabla: "Equipos", acc: "b", registro: req.body.id })
        return res.json({ status: true, icon: "success", title: "Éxito", text: "Equipo dado de baja correctamente" })
    } catch (error) {
        console.log(error)
        return res.json({ status: false, icon: "error", title: "Error", text: "Hubo un error al procesar la solicitud" })
    }
}

const ValidarCampos = o => {
    return new Promise((resolve, reject) => {
        if(!o || typeof o.nombre !== 'string' || o.nombre.trim().length == 0) return resolve({ status: false, icon:'error', title: 'Error', text: 'Debe ingresar el nombre del equipo' })
        if(o.nombre.trim().length > 40) return resolve({ status: false, icon:'error', title: 'Error', text: 'El nombre superó la cantidad permitida' })
        if(o.escudo != null && typeof o.escudo !== 'string') return resolve({ status: false, icon:'error', title:'Error', text:'El enlace del escudo debe ser texto' })
        if(o.escudo && o.escudo.trim().length > 200) return resolve({ status:false, icon:'error', title:'Error', text:'El enlace del escudo no puede superar los 200 caracteres' })
        if(o.id_club_fk === '') o.id_club_fk = null
        if(o.id_club_fk != null && (!Number.isInteger(Number(o.id_club_fk)) || Number(o.id_club_fk) < 1)) return resolve({ status:false, icon:'error', title:'Error', text:'El club seleccionado es inválido' })
        o.id_club_fk = o.id_club_fk == null ? null : Number(o.id_club_fk)
        o.escudo = o.escudo && o.escudo.trim() ? o.escudo.trim() : null
        o.activo = utils.changeToBoolean(o.activo)
        return resolve({ status: true })
    })
}