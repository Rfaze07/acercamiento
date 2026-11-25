window.inicializarFiltrosWeb = function(opciones) {
  const $competencia = $('#filtroCompetencia')
  const $categoria = $('#filtroCategoria')
  const $categoriasDisponibles = $('#categoriasDisponibles')
  const $buscar = $('#btnBuscar')
  const $resultados = $(opciones.selectorResultados)

  $('.selectpicker').selectpicker()

  const mostrarMensaje = mensaje => {
    if (opciones.limpiarResultados) opciones.limpiarResultados()
    else $resultados.empty()
    $resultados.append($('<div>').addClass(opciones.claseVacio).text(mensaje))
  }

  const validarBusqueda = () => {
    $buscar.prop('disabled', !($competencia.val() && $categoria.val()))
  }

  const actualizarCategorias = () => {
    const idTorneo = String($competencia.val() || '')
    const textoInicial = idTorneo
      ? 'Seleccionar categoría'
      : 'Primero seleccioná una competencia'
    const $nuevaCategoria = $('<option>').val('').text(textoInicial)
    $categoria.empty().append($nuevaCategoria)

    if (idTorneo) {
      $categoriasDisponibles.find('option').each(function() {
        if (String($(this).data('torneo')) === idTorneo) {
          $categoria.append($(this).clone())
        }
      })
    }

    const tieneCategorias = $categoria.find('option').length > 1
    $categoria.prop('disabled', !idTorneo || !tieneCategorias)
    if (idTorneo && !tieneCategorias) {
      $categoria.find('option').first().text('No hay categorías activas')
    }
    $categoria.selectpicker('refresh')
    $categoria.selectpicker('val', '')
    validarBusqueda()
    mostrarMensaje(idTorneo && tieneCategorias
      ? 'Seleccioná una categoría y presioná Buscar.'
      : opciones.mensajeInicial)
  }

  $competencia.on('change', actualizarCategorias)
  $categoria.on('change', function() {
    validarBusqueda()
    if ($categoria.val()) mostrarMensaje('Presioná Buscar para ver los resultados.')
  })
  $buscar.on('click', async function() {
    const idTorneo = Number($competencia.val())
    const idCategoria = Number($categoria.val())
    if (!Number.isSafeInteger(idTorneo) || idTorneo < 1 ||
        !Number.isSafeInteger(idCategoria) || idCategoria < 1) {
      return
    }

    $buscar.prop('disabled', true)
    $('#preloaderAPP').show()
    try {
      await opciones.buscar(idTorneo, idCategoria)
    } catch (error) {
      console.error(opciones.mensajeError, error)
      mostrarMensaje(opciones.mensajeError)
    } finally {
      $('#preloaderAPP').hide()
      validarBusqueda()
    }
  })

  actualizarCategorias()
}
