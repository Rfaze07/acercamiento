const express = require("express")
const router = express.Router()
const controller = require("./controller")
const { auth, checkAcceso } = require("../../middlewares")

router.get("/tiposCompetencia", auth, checkAcceso("c"), controller.getLista)
router.post("/tiposCompetencia/getListaAjax", auth, checkAcceso("c"), controller.getListaAjax)
router.post("/tiposCompetencia/getListaSelectAjax", auth, controller.getListaSelectAjax)
router.post("/tiposCompetencia/getByIdAjax", auth, checkAcceso("c"), controller.getByIdAjax)
router.post("/tiposCompetencia/alta", auth, checkAcceso("a"), controller.postAlta)
router.post("/tiposCompetencia/modificar", auth, checkAcceso("m"), controller.postModificar)
router.post("/tiposCompetencia/eliminar", auth, checkAcceso("b"), controller.postEliminar)

module.exports = router
