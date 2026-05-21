const tooltipState = {
  el: null,
  menuOpen: false
};

function getTooltipElement() {
  return tooltipState.el;
}

function queryTooltip(selector) {
  return tooltipState.el?.querySelector(selector) ?? null;
}

function removeTooltip() {
  tooltipState.menuOpen = false;
  if (tooltipState.el) {
    tooltipState.el.remove();
    tooltipState.el = null;
  }
}

function setMenuOpen(open) {
  tooltipState.menuOpen = open;
  if (!tooltipState.el) {
    return;
  }

  const menuButton = queryTooltip(`#${AIW_CONFIG.dom.menuButton}`);
  const menu = queryTooltip(`#${AIW_CONFIG.dom.menu}`);
  menuButton?.setAttribute("aria-expanded", open ? "true" : "false");
  if (menu) {
    menu.hidden = !open;
  }
}

function isMenuOpen() {
  return tooltipState.menuOpen;
}

function renderMainButtonLabel() {
  const button = queryTooltip(`#${AIW_CONFIG.dom.mainButton}`);
  if (!button) {
    return;
  }
  const label = getActionLabel(getCurrentActionId());
  button.innerHTML = `${AIW_CONFIG.icons.wand}<span>${label}</span>`;
}

function setLoading(loading) {
  if (!tooltipState.el) {
    return;
  }

  const button = queryTooltip(`#${AIW_CONFIG.dom.mainButton}`);
  const menuButton = queryTooltip(`#${AIW_CONFIG.dom.menuButton}`);
  if (!button) {
    return;
  }

  if (menuButton) {
    menuButton.disabled = loading;
  }

  if (loading) {
    setMenuOpen(false);
    tooltipState.el.classList.add("aiw-loading");
    button.innerHTML = '<span class="aiw-stop-indicator" aria-hidden="true"></span>';
    button.setAttribute("aria-label", "Stop");
    return;
  }

  tooltipState.el.classList.remove("aiw-loading");
  renderMainButtonLabel();
  button.removeAttribute("aria-label");
}

function buildMenuHtml(actions) {
  return actions
    .map(
      (action) =>
        `<li role="none"><button type="button" class="aiw-menu-item" role="menuitem" data-action-id="${action.id}">${action.label}</button></li>`
    )
    .join("");
}

function buildTooltipHtml(actions, mainLabel) {
  const { mainButton, menuButton, menu } = AIW_CONFIG.dom;
  return `
    <div class="aiw-split">
      <button type="button" id="${mainButton}" class="aiw-split-main">
        ${AIW_CONFIG.icons.wand}
        <span>${mainLabel}</span>
      </button>
      <div class="aiw-split-divider" aria-hidden="true"></div>
      <button type="button" id="${menuButton}" class="aiw-split-menu" aria-haspopup="true" aria-expanded="false" aria-label="More actions">
        ${AIW_CONFIG.icons.chevron}
      </button>
    </div>
    <ul id="${menu}" class="aiw-menu" role="menu" hidden>
      ${buildMenuHtml(actions)}
    </ul>
  `;
}

function positionTooltip(root, details) {
  const anchor = getSelectionAnchorRect(details);
  root.style.left = `${window.scrollX + anchor.left}px`;
  root.style.top = `${window.scrollY + anchor.bottom}px`;
  root.style.transform = `translateY(calc(-100% - ${AIW_CONFIG.tooltipGapPx}px))`;
}

function bindTooltipEvents(root) {
  const mainButton = root.querySelector(`#${AIW_CONFIG.dom.mainButton}`);
  const menuButton = root.querySelector(`#${AIW_CONFIG.dom.menuButton}`);
  const menu = root.querySelector(`#${AIW_CONFIG.dom.menu}`);

  const preventSelectionLoss = (event) => {
    event.preventDefault();
  };

  for (const el of [mainButton, menuButton, menu]) {
    el?.addEventListener("mousedown", preventSelectionLoss);
  }

  mainButton?.addEventListener("click", () => {
    if (isImproveInFlight()) {
      stopImprove();
      return;
    }
    void runImprove(getCurrentActionId());
  });

  menuButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    setMenuOpen(!tooltipState.menuOpen);
  });

  menu?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const item = target.closest("[data-action-id]");
    if (!(item instanceof HTMLElement)) {
      return;
    }
    const actionId = item.dataset.actionId;
    if (!actionId) {
      return;
    }
    setCurrentActionId(actionId);
    renderMainButtonLabel();
    setMenuOpen(false);
    void runImprove(actionId);
  });
}

async function createTooltip(details) {
  removeTooltip();

  const actions = await loadActions();
  const resolvedAction =
    actions.find((action) => action.id === getCurrentActionId()) ?? actions[0];
  if (resolvedAction) {
    setCurrentActionId(resolvedAction.id);
  }

  const root = document.createElement("div");
  root.id = AIW_CONFIG.dom.root;
  positionTooltip(root, details);
  root.innerHTML = buildTooltipHtml(actions, getActionLabel(getCurrentActionId()));

  document.body.appendChild(root);
  tooltipState.el = root;
  bindTooltipEvents(root);
}

function refreshTooltip() {
  const details = getSelectionDetails();
  if (!details) {
    clearSelectedState();
    removeTooltip();
    return;
  }

  const previous = getSelectedState();
  const unchanged =
    tooltipState.el &&
    previous?.text === details.text &&
    previous?.mode === details.mode &&
    previous?.start === details.start &&
    previous?.end === details.end;

  setSelectedState(details);

  if (unchanged) {
    positionTooltip(tooltipState.el, details);
    return;
  }

  void createTooltip(details);
}

function shouldRefreshTooltipFromEvent(event) {
  if (!tooltipState.el || !(event.target instanceof Node)) {
    return true;
  }
  return !tooltipState.el.contains(event.target);
}

function handleEscapeKey() {
  if (isImproveInFlight()) {
    stopImprove();
    return true;
  }
  if (isMenuOpen()) {
    setMenuOpen(false);
    return true;
  }
  clearSelectedState();
  removeTooltip();
  return true;
}
