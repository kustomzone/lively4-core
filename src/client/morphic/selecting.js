$("body").on("click", handleSelect);
$("body").on("mouseup", handleMouseUp);

function handleSelect(e) {
  if (e.ctrlKey || e.metaKey) {
    onMagnify(e);
    e.stopPropagation();
  }
}

function handleMouseUp(e) {
  // hide halos if the user clicks somewhere else
  if (!(e.ctrlKey || e.metaKey)) {
    if (window.that && !$(e.target).is("lively-halos")) {
      hideHalos()
    }
  }
}

function onMagnify(e) {
  var grabTarget = e.target;
  var that = window.that;
  var $that = $(that);
  if (that && areHalosActive() && (grabTarget === that || $.contains(that, grabTarget))) {
    parent = $that.parent();
    if (!parent.is("html")) {
      grabTarget = parent.get(0);
    }
  }

  // if there was no suitable parent, cycle back to the clicked element itself
  window.that = grabTarget;

  showHalos(grabTarget)
}

function showHalos(el) {
  HaloService.showHalos(el);
}

function hideHalos() {
  HaloService.hideHalos();
}

function areHalosActive() {
  return HaloService.areHalosActive();
}
