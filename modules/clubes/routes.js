const express = require("express")
const router = express.Router()
const controller = require("./controller")
const { auth, checkAcceso } = require("../../middlewares")

router.get("/clubes", auth, checkAcceso("c"), controller.getLista)
router.post("/clubes/getListaAjax", auth, checkAcceso("c"), controller.getListaAjax)
router.post("/clubes/getListaSelectAjax", auth, controller.getListaSelectAjax)
router.post("/clubes/getByIdAjax", auth, checkAcceso("c"), controller.getByIdAjax)
router.post("/clubes/alta", auth, checkAcceso("a"), controller.postAlta)
router.post("/clubes/modificar", auth, checkAcceso("m"), controller.postModificar)
router.post("/clubes/eliminar", auth, checkAcceso("b"), controller.postEliminar)

module.exports = router
