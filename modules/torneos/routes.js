const express = require("express")
const router = express.Router()
const controller = require("./controller")
const { auth, checkAcceso } = require("../../middlewares")

const permisoOrganizacion = (req, res, next) => {
    const permisos = { alta: "a", modificar: "m", eliminar: "b" }
    const permiso = permisos[req.params.accion]
    if (!permiso) return res.status(404).json({ status: false, text: "La acción solicitada no existe" })
    return checkAcceso(permiso)(req, res, next)
}

router.get("/torneos", auth, checkAcceso("c"), controller.getLista)
router.post("/torneos/getListaAjax", auth, checkAcceso("c"), controller.getListaAjax)
router.post("/torneos/getByIdAjax", auth, checkAcceso("c"), controller.getByIdAjax)
router.post("/torneos/alta", auth, checkAcceso("a"), controller.postAlta)
router.post("/torneos/modificar", auth, checkAcceso("m"), controller.postModificar)
router.post("/torneos/eliminar", auth, checkAcceso("b"), controller.postEliminar)
router.get("/torneos/:id/organizacion", auth, checkAcceso("c"), controller.getOrganizacion)
router.post("/torneos/:id/organizacion/datos", auth, checkAcceso("c"), controller.getOrganizacionAjax)
router.post("/torneos/:id/organizacion/:entidad/:accion", auth, permisoOrganizacion, controller.organizacionAction)

module.exports = router
