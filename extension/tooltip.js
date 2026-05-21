const tooltipState = {
  el: null,
  menuOpen: false,
  openSubmenuRow: null
};

function getTooltipElement() {
  return tooltipState.el;
}

function queryTooltip(selector) {
  return tooltipState.el?.querySelector(selector) ?? null;
}

function removeTooltip() {
  tooltipState.menuOpen = false;
  closeSubmenu();
  if (tooltipState.el) {
    tooltipState.el.remove();
    tooltipState.el = null;
  }
}

function closeSubmenu() {
  if (tooltipState.openSubmenuRow) {
    tooltipState.openSubmenuRow.classList.remove("aiw-menu-row--open");
    const submenu = tooltipState.openSubmenuRow.querySelector(".aiw-submenu");
    if (submenu) {
      submenu.hidden = true;
    }
    tooltipState.openSubmenuRow = null;
  }
}

function setMenuOpen(open) {
  tooltipState.menuOpen = open;
  if (!open) {
    closeSubmenu();
  }
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

function buildLeafItemHtml(leaf) {
  return `<li role="none" class="aiw-menu-row">
    <button type="button" class="aiw-menu-item" role="menuitem" data-action-id="${leaf.id}">${leaf.label}</button>
  </li>`;
}

function buildSubmenuHtml(children) {
  return children.map((node) => (aiwIsLeaf(node) ? buildLeafItemHtml(node) : "")).join("");
}

function buildMenuNodesHtml(nodes) {
  return nodes
    .map((node) => {
      if (aiwIsLeaf(node)) {
        return buildLeafItemHtml(node);
      }
      if (!Array.isArray(node.children) || node.children.length === 0) {
        return "";
      }
      return `<li role="none" class="aiw-menu-row aiw-menu-row--parent" data-group-id="${node.id}">
        <button type="button" class="aiw-menu-item aiw-menu-item--parent" role="menuitem" aria-haspopup="true" aria-expanded="false">
          <span class="aiw-menu-item-label">${node.label}</span>
          ${AIW_CONFIG.icons.chevronRight}
        </button>
        <ul class="aiw-submenu" role="menu" hidden>
          ${buildSubmenuHtml(node.children)}
        </ul>
      </li>`;
    })
    .join("");
}

function buildTooltipHtml(mainLabel) {
  const { mainButton, menuButton, menu } = AIW_CONFIG.dom;
  return `
    <ul id="${menu}" class="aiw-menu" role="menu" hidden>
      ${buildMenuNodesHtml(aiwGetActionTree())}
    </ul>
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
  `;
}

function positionSubmenu(row) {
  const submenu = row.querySelector(".aiw-submenu");
  if (!submenu) {
    return;
  }
  submenu.classList.remove("aiw-submenu--flip");
  const rect = submenu.getBoundingClientRect();
  if (rect.right > window.innerWidth - 8) {
    submenu.classList.add("aiw-submenu--flip");
  }
}

function openSubmenu(row) {
  if (tooltipState.openSubmenuRow === row) {
    return;
  }
  closeSubmenu();
  const submenu = row.querySelector(".aiw-submenu");
  const trigger = row.querySelector(".aiw-menu-item--parent");
  if (!submenu || !trigger) {
    return;
  }
  row.classList.add("aiw-menu-row--open");
  submenu.hidden = false;
  trigger.setAttribute("aria-expanded", "true");
  tooltipState.openSubmenuRow = row;
  positionSubmenu(row);
}

function handleMenuActionClick(actionId) {
  if (!actionId) {
    return;
  }
  setCurrentActionId(actionId);
  renderMainButtonLabel();
  setMenuOpen(false);
  void runImprove(actionId);
}

function bindMenuEvents(menu) {
  if (!menu) {
    return;
  }

  menu.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const parentTrigger = target.closest(".aiw-menu-item--parent");
    if (parentTrigger) {
      event.stopPropagation();
      const row = parentTrigger.closest(".aiw-menu-row--parent");
      if (row instanceof HTMLElement) {
        if (tooltipState.openSubmenuRow === row) {
          closeSubmenu();
        } else {
          openSubmenu(row);
        }
      }
      return;
    }

    const item = target.closest("[data-action-id]");
    if (!(item instanceof HTMLElement)) {
      return;
    }
    handleMenuActionClick(item.dataset.actionId);
  });

  for (const row of menu.querySelectorAll(".aiw-menu-row--parent")) {
    row.addEventListener("mouseenter", () => {
      if (row instanceof HTMLElement) {
        openSubmenu(row);
      }
    });
  }

  menu.addEventListener("mouseleave", (event) => {
    const related = event.relatedTarget;
    if (related instanceof Node && menu.contains(related)) {
      return;
    }
    closeSubmenu();
  });
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

  bindMenuEvents(menu);
}

function createTooltip(details) {
  removeTooltip();
  loadActions();

  const resolvedAction = aiwResolveLeaf(getCurrentActionId());
  if (resolvedAction) {
    setCurrentActionId(resolvedAction.id);
  }

  const root = document.createElement("div");
  root.id = AIW_CONFIG.dom.root;
  positionTooltip(root, details);
  root.innerHTML = buildTooltipHtml(getActionLabel(getCurrentActionId()));

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

  createTooltip(details);
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
  if (tooltipState.openSubmenuRow) {
    closeSubmenu();
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
