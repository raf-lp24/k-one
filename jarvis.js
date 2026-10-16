// JARVIS — panel de administración de K-ONE. Vivía dentro de index.html y lo descargaba
// cada visitante (~165 KB). Desde el 16 oct 2026 está aquí y solo lo pide quien abre el
// panel: abrirPanelAdmin() → _cargarJarvis() en index.html. Comparte el ámbito global con
// el script principal (supa, showToast, _esc, _fmtFecha, _csvSafe...). La seguridad no
// depende de esto: cada acción la valida el servidor (api/admin.js, ADMIN_EMAILS).
(function () {
  document.body.insertAdjacentHTML('beforeend', "<!-- PANEL DE ADMIN — JARVIS -->\n<div id=\"modalAdmin\" style=\"display:none;position:fixed;inset:0;z-index:10000;background:var(--negro);overflow-y:auto\">\n\n  <!-- Sidebar de cristal: marca, navegación y acciones. La cápsula \"JARVIS\"\n       con el punto vivo es la firma del panel — se lee como un instrumento\n       encendido, no como un menú más. -->\n  <div class=\"jarvis-sidebar\">\n    <div class=\"jarvis-sidebar-brand\" style=\"margin-bottom:22px\">\n      <div class=\"logo\" style=\"font-size:19px;letter-spacing:3px;user-select:none;margin-bottom:14px\">K-<span>ONE</span></div>\n      <div style=\"display:flex;align-items:center;gap:9px\">\n        <span style=\"width:7px;height:7px;border-radius:50%;background:var(--jv-ok);box-shadow:0 0 9px var(--jv-ok);flex-shrink:0\"></span>\n        <span style=\"font-family:var(--jv-display);font-weight:800;font-size:25px;letter-spacing:-.03em;color:var(--jv-text);line-height:1\">Jarvis</span>\n      </div>\n      <div style=\"font-size:11.5px;font-weight:600;color:var(--jv-faint);margin-top:6px;letter-spacing:-.01em\">Centro de control</div>\n      <div id=\"adminTimestamp\" style=\"font-size:11px;color:var(--jv-faint);margin-top:9px;font-weight:500;opacity:.72\"></div>\n    </div>\n\n    <div class=\"jarvis-sidebar-nav\" style=\"flex:1;display:flex;flex-direction:column\" id=\"jarvisTabs\">\n      <button class=\"jarvis-tab jarvis-tab-active\" onclick=\"jarvisTab('dashboard')\">Dashboard</button>\n      <button class=\"jarvis-tab\" onclick=\"jarvisTab('clientes')\">Clientes</button>\n      <button class=\"jarvis-tab\" onclick=\"jarvisTab('buzon')\">Buzón <span id=\"jarvisBuzonBadge\" style=\"background:var(--jv-accent);color:#fff;font-size:10px;font-weight:700;padding:1px 7px;border-radius:999px;margin-left:6px;display:none\">0</span></button>\n      <button class=\"jarvis-tab\" onclick=\"jarvisTab('leads')\">Leads</button>\n      <button class=\"jarvis-tab\" onclick=\"jarvisTab('emails')\">Emails</button>\n    </div>\n\n    <div class=\"jarvis-sidebar-actions\" style=\"display:flex;flex-direction:column;gap:8px;margin-top:16px;padding-top:16px;border-top:1px solid var(--jv-line)\">\n      <!-- Mismo mecanismo de push que usan los clientes (push_subscriptions,\n           activarNotificaciones/desactivarNotificaciones/actualizarBotonNotificaciones\n           en index.html) -- aquí el \"cliente\" es la propia cuenta del admin.\n           Oculto hasta saber el estado real; ver el bloque gemelo del\n           dashboard de cliente para el porqué de dejarlo deshabilitado (no\n           escondido) si el navegador bloqueó el permiso. -->\n      <div data-push-toggle style=\"display:none\">\n        <div style=\"display:flex;align-items:center;justify-content:space-between;gap:10px;padding:4px 2px\">\n          <span style=\"font-family:var(--jv-ui);font-size:12.5px;color:var(--jv-dim);font-weight:600\">Avisos de registro</span>\n          <label class=\"jv-toggle-switch\">\n            <input type=\"checkbox\" class=\"push-toggle-input\" data-push-tipo=\"registro\" onchange=\"onPushToggleChange(this)\" aria-label=\"Avisos push cuando se registra un cliente nuevo\" data-hint-on=\"Te avisamos al momento cuando se registre un cliente nuevo.\">\n            <span class=\"jv-toggle-slider\"></span>\n          </label>\n        </div>\n        <p class=\"push-toggle-hint\" style=\"display:none;margin:2px 0 0;font-size:10.5px;color:var(--jv-faint);line-height:1.4;font-family:var(--jv-ui)\"></p>\n      </div>\n      <button onclick=\"mostrarFormAltaCliente()\" style=\"background:rgba(61,220,151,.13);border:1px solid rgba(61,220,151,.3);border-radius:11px;padding:10px 14px;font-size:12.5px;color:var(--jv-ok);cursor:pointer;font-family:var(--jv-ui);font-weight:700;letter-spacing:-.01em;transition:background .15s\" onmouseenter=\"this.style.background='rgba(61,220,151,.2)'\" onmouseleave=\"this.style.background='rgba(61,220,151,.13)'\">+ Añadir cliente</button>\n      <button onclick=\"exportarAdminCSV()\" style=\"background:var(--jv-glass);border:1px solid var(--jv-line);border-radius:11px;padding:10px 14px;font-size:12.5px;color:var(--jv-dim);cursor:pointer;font-family:var(--jv-ui);font-weight:600;letter-spacing:-.01em;transition:all .15s\" onmouseenter=\"this.style.color='var(--jv-text)';this.style.borderColor='var(--jv-line-hi)'\" onmouseleave=\"this.style.color='var(--jv-dim)';this.style.borderColor='var(--jv-line)'\">Exportar CSV</button>\n      <button onclick=\"abrirPanelAdmin()\" style=\"background:var(--jv-glass);border:1px solid var(--jv-line);border-radius:11px;padding:10px 14px;font-size:12.5px;color:var(--jv-dim);cursor:pointer;font-family:var(--jv-ui);font-weight:600;letter-spacing:-.01em;transition:all .15s\" onmouseenter=\"this.style.color='var(--jv-text)';this.style.borderColor='var(--jv-line-hi)'\" onmouseleave=\"this.style.color='var(--jv-dim)';this.style.borderColor='var(--jv-line)'\">Actualizar datos</button>\n      <button onclick=\"cerrarPanelAdmin()\" style=\"background:linear-gradient(135deg,var(--jv-accent),#E8471B);border:none;border-radius:11px;padding:10px 14px;font-size:12.5px;color:#fff;cursor:pointer;font-weight:700;font-family:var(--jv-ui);letter-spacing:-.01em;box-shadow:0 4px 16px rgba(255,95,46,.28)\">Cerrar Jarvis</button>\n    </div>\n  </div>\n\n  <div class=\"jarvis-main\">\n\n    <!-- TAB: Dashboard -->\n    <div class=\"jarvis-panel\" id=\"jarvisPanel-dashboard\">\n      <!-- Estado operativo: los interruptores de negocio que se tocan desde fuera\n           del panel (Stripe, Supabase) y que se olvidan con el tiempo. Son valores\n           fijos del código actual, no una comprobación en vivo — por eso el aviso. -->\n      <div class=\"jv-card\" style=\"padding:17px 19px;margin-bottom:22px\">\n        <div class=\"jv-head\" style=\"margin-bottom:12px\">\n          <span class=\"jv-head-bar\"></span>\n          <span class=\"jv-head-txt\">Estado operativo</span>\n          <span class=\"jv-head-meta\">Valores fijos del código, no lectura en vivo</span>\n        </div>\n        <div style=\"display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;font-size:12.5px;color:var(--jv-dim);line-height:1.6\">\n          <div><strong style=\"color:var(--jv-text);font-weight:700\">Primer mes:</strong> gratis automático para todo cliente nuevo, cualquier plan (desde 19 ago 2026)</div>\n          <div><strong style=\"color:var(--jv-text);font-weight:700\">Códigos promocionales:</strong> retirados (2026-08). Ya no existen códigos de mes gratis ni de % de descuento — el único beneficio es el mes gratis automático de arriba. El campo de código en el registro ahora es solo para invitaciones de amigos.</div>\n          <div><strong style=\"color:var(--jv-text);font-weight:700\">Incentivo referidos:</strong> pausado (5€/amigo, en espera de nueva mecánica)</div>\n        </div>\n      </div>\n      <div id=\"adminAccion\" style=\"margin-bottom:26px\"></div>\n      <div id=\"adminMetricsBiz\" style=\"display:grid;grid-template-columns:repeat(auto-fit,minmax(172px,1fr));gap:13px;margin-bottom:26px\"></div>\n      <div style=\"display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-bottom:26px\">\n        <div>\n          <div class=\"jv-head\"><span class=\"jv-head-bar\"></span><span class=\"jv-head-txt\">Esta semana</span></div>\n          <div id=\"adminMetricsTrend\" style=\"display:grid;grid-template-columns:1fr 1fr;gap:11px\"></div>\n        </div>\n        <div>\n          <div class=\"jv-head\"><span class=\"jv-head-bar\"></span><span class=\"jv-head-txt\">Engagement</span></div>\n          <div id=\"adminMetricsEng\" style=\"display:grid;grid-template-columns:1fr 1fr;gap:11px\"></div>\n        </div>\n      </div>\n      <div class=\"jv-head\"><span class=\"jv-head-bar\"></span><span class=\"jv-head-txt\">Alertas</span></div>\n      <div id=\"adminMetricsAlt\" style=\"display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:11px;margin-bottom:30px\"></div>\n      <div class=\"jv-head\"><span class=\"jv-head-bar\"></span><span class=\"jv-head-txt\">Distribución</span></div>\n      <div id=\"adminDist\" style=\"display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px\"></div>\n    </div>\n\n    <!-- TAB: Clientes -->\n    <div class=\"jarvis-panel\" id=\"jarvisPanel-clientes\" style=\"display:none\">\n      <div style=\"display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px\">\n        <div class=\"jv-title\">\n          <span id=\"adminTotalFiltro\">0</span> <span style=\"color:var(--jv-faint);font-weight:600\">de</span> <span id=\"adminTotalClientes\">0</span> <span style=\"color:var(--jv-faint);font-weight:600\">clientes</span>\n          <!-- Los premium no salen en la tabla general (ver renderTablaAdmin).\n               Esta línea dice cuántos hay ocultos y da el atajo para verlos. -->\n          <div id=\"adminAvisoPremium\" style=\"display:none;font-family:var(--jv-ui);font-size:11px;font-weight:600;color:var(--jv-faint);margin-top:4px;letter-spacing:0\"></div>\n        </div>\n        <div id=\"adminFiltrosWrap\" style=\"display:flex;gap:6px;flex-wrap:wrap;align-items:center;min-width:0\">\n          <input id=\"adminBuscador\" type=\"text\" placeholder=\"Buscar...\" aria-label=\"Buscar clientes\" oninput=\"buscarAdmin(this.value)\"\n            style=\"background:var(--jv-glass);border:1px solid var(--jv-line);border-radius:999px;padding:8px 16px;font-size:12.5px;color:var(--jv-text);width:190px;max-width:100%;outline:none;font-family:var(--jv-ui);font-weight:500;box-sizing:border-box\">\n          <div style=\"display:flex;gap:4px\" id=\"adminFiltrosBtns\">\n            <button class=\"jarvis-filtro jarvis-filtro-active\" onclick=\"filtrarAdminTipo('todos')\">Todos</button>\n            <button class=\"jarvis-filtro\" onclick=\"filtrarAdminTipo('alertas')\">Alertas</button>\n            <button class=\"jarvis-filtro\" onclick=\"filtrarAdminTipo('revisar')\">Revisar plan</button>\n            <button class=\"jarvis-filtro\" onclick=\"filtrarAdminTipo('activos')\">Pagando</button>\n            <button class=\"jarvis-filtro\" onclick=\"filtrarAdminTipo('prueba')\">Mes gratis</button>\n            <button class=\"jarvis-filtro\" onclick=\"filtrarAdminTipo('premium')\">Premium</button>\n            <button class=\"jarvis-filtro\" onclick=\"filtrarAdminTipo('sinpago')\">Sin pago</button>\n            <button class=\"jarvis-filtro\" onclick=\"filtrarAdminTipo('nuevos')\">Nuevos</button>\n            <button class=\"jarvis-filtro\" onclick=\"filtrarAdminTipo('bajas')\">Bajas</button>\n          </div>\n          <div style=\"font-family:var(--jv-ui);font-size:10.5px;font-weight:700;color:var(--jv-faint);letter-spacing:.07em;text-transform:uppercase;margin-top:10px;width:100%\">Estudio de mercado</div>\n          <div style=\"display:flex;gap:4px;flex-wrap:wrap;margin-top:4px\">\n            <select id=\"adminFiltroPlan\" aria-label=\"Filtrar por plan\" onchange=\"filtrarAdminTipo(_adminFiltro.tipo)\" class=\"jv-select\">\n              <option value=\"\">Plan: todos</option>\n              <option value=\"completo\">Completo</option>\n              <option value=\"nutricion\">Solo nutrición</option>\n            </select>\n            <select id=\"adminFiltroDeporte\" aria-label=\"Filtrar por deporte\" onchange=\"filtrarAdminTipo(_adminFiltro.tipo)\" class=\"jv-select\">\n              <option value=\"\">Deporte: todos</option>\n              <option value=\"Gimnasio\">Gimnasio</option>\n              <option value=\"Running\">Running</option>\n              <option value=\"CrossFit\">CrossFit</option>\n              <option value=\"Hyrox\">Hyrox</option>\n              <option value=\"Híbrido\">Híbrido</option>\n            </select>\n            <select id=\"adminFiltroObjetivo\" aria-label=\"Filtrar por objetivo\" onchange=\"filtrarAdminTipo(_adminFiltro.tipo)\" class=\"jv-select\">\n              <option value=\"\">Objetivo: todos</option>\n              <option value=\"Perder\">Perder grasa</option>\n              <option value=\"músculo\">Ganar músculo</option>\n              <option value=\"mejor\">Sentirme mejor</option>\n            </select>\n            <select id=\"adminFiltroEntrenos\" aria-label=\"Filtrar por entrenos\" onchange=\"filtrarAdminTipo(_adminFiltro.tipo)\" class=\"jv-select\">\n              <option value=\"\">Entrenos: todos</option>\n              <option value=\"0\">0 entrenos</option>\n              <option value=\"1-5\">1-5 entrenos</option>\n              <option value=\"6+\">6+ entrenos</option>\n            </select>\n            <select id=\"adminFiltroPrecio\" aria-label=\"Filtrar por precio\" onchange=\"filtrarAdminTipo(_adminFiltro.tipo)\" class=\"jv-select\">\n              <option value=\"\">Precio: todos</option>\n              <option value=\"Oferta 1,99\">Oferta 1,99€</option>\n              <option value=\"Mensual 7,99\">Mensual 7,99€</option>\n              <option value=\"Trimestral 14,99\">Trimestral 14,99€</option>\n              <option value=\"Nutrición 4,99\">Nutrición 4,99€</option>\n              <option value=\"antiguo\">Precios antiguos</option>\n              <option value=\"premium\">Premium gratuito</option>\n              <option value=\"sinpago\">Sin pago</option>\n            </select>\n          </div>\n        </div>\n      </div>\n      <div class=\"jv-card\" style=\"overflow-x:auto\">\n        <table id=\"adminTabla\" style=\"width:100%;border-collapse:collapse;font-size:13px;color:var(--blanco);min-width:1050px\"></table>\n      </div>\n    </div>\n\n    <!-- TAB: Buzón -->\n    <div class=\"jarvis-panel\" id=\"jarvisPanel-buzon\" style=\"display:none\">\n      <div style=\"display:flex;align-items:center;justify-content:space-between;margin-bottom:20px\">\n        <div style=\"display:flex;align-items:center;gap:12px\">\n          <div style=\"width:40px;height:40px;border-radius:13px;background:linear-gradient(135deg,var(--jv-accent),var(--jv-accent-2));display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(255,95,46,.3)\">\n            <svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2\"><path d=\"M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z\"/></svg>\n          </div>\n          <div>\n            <div class=\"jv-title\">Buzón de mensajes</div>\n            <div class=\"jv-title-sub\">Contactos de clientes</div>\n          </div>\n        </div>\n        <span id=\"adminMensajesCount\" class=\"jv-chip\" style=\"background:rgba(255,95,46,.13);color:var(--jv-accent-2);border:1px solid rgba(255,95,46,.25);text-transform:none;letter-spacing:0;font-size:11.5px\"></span>\n      </div>\n      <div style=\"display:flex;align-items:center;gap:8px;margin-bottom:10px\">\n        <label style=\"display:flex;align-items:center;gap:7px;font-size:12px;color:var(--jv-dim);font-family:var(--jv-ui);font-weight:600;cursor:pointer;user-select:none\">\n          <input type=\"checkbox\" id=\"mensajesSeleccionarTodos\" onchange=\"toggleSeleccionarTodosMensajes(this.checked)\" style=\"accent-color:var(--jv-accent);width:15px;height:15px;cursor:pointer\">\n          Seleccionar todos\n        </label>\n      </div>\n      <div id=\"mensajesSeleccionBar\" style=\"display:none;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;background:rgba(255,95,46,.08);border:1px solid rgba(255,95,46,.25);border-radius:12px;padding:10px 16px;margin-bottom:10px\">\n        <span id=\"mensajesSeleccionCount\" style=\"font-size:12.5px;color:var(--jv-text);font-family:var(--jv-ui);font-weight:600\"></span>\n        <div style=\"display:flex;align-items:center;gap:8px\">\n          <button id=\"btnMarcarMensajesSeleccionados\" onclick=\"marcarSeleccionadosMensajesGestionados()\" class=\"jv-btn jv-btn-success\">Marcar como gestionados</button>\n          <button id=\"btnEliminarMensajesSeleccionados\" onclick=\"eliminarMensajesSeleccionados()\" class=\"jv-btn jv-btn-danger-solid\">Eliminar seleccionados</button>\n          <button onclick=\"cancelarSeleccionMensajes()\" class=\"jv-btn jv-btn-ghost\">Cancelar</button>\n        </div>\n      </div>\n      <div id=\"adminMensajesList\" style=\"display:flex;flex-direction:column;gap:10px\"></div>\n    </div>\n\n    <!-- TAB: Leads -->\n    <div class=\"jarvis-panel\" id=\"jarvisPanel-leads\" style=\"display:none\">\n      <div style=\"display:flex;align-items:center;justify-content:space-between;margin-bottom:20px\">\n        <div style=\"display:flex;align-items:center;gap:12px\">\n          <div style=\"width:40px;height:40px;border-radius:13px;background:linear-gradient(135deg,var(--jv-accent),var(--jv-accent-2));display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(255,95,46,.3)\">\n            <svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2\"><path d=\"M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75\"/></svg>\n          </div>\n          <div>\n            <div class=\"jv-title\">Leads interesados</div>\n            <div class=\"jv-title-sub\">Emails que pidieron información</div>\n          </div>\n        </div>\n        <span id=\"adminLeadsCount\" class=\"jv-chip\" style=\"background:rgba(255,95,46,.13);color:var(--jv-accent-2);border:1px solid rgba(255,95,46,.25);text-transform:none;letter-spacing:0;font-size:11.5px\"></span>\n      </div>\n      <div style=\"display:flex;align-items:center;gap:8px;margin-bottom:10px\">\n        <label style=\"display:flex;align-items:center;gap:7px;font-size:12px;color:var(--jv-dim);font-family:var(--jv-ui);font-weight:600;cursor:pointer;user-select:none\">\n          <input type=\"checkbox\" id=\"leadsSeleccionarTodos\" onchange=\"toggleSeleccionarTodosLeads(this.checked)\" style=\"accent-color:var(--jv-accent);width:15px;height:15px;cursor:pointer\">\n          Seleccionar todos\n        </label>\n      </div>\n      <div id=\"leadsSeleccionBar\" style=\"display:none;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;background:rgba(255,95,46,.08);border:1px solid rgba(255,95,46,.25);border-radius:12px;padding:10px 16px;margin-bottom:10px\">\n        <span id=\"leadsSeleccionCount\" style=\"font-size:12.5px;color:var(--jv-text);font-family:var(--jv-ui);font-weight:600\"></span>\n        <div style=\"display:flex;align-items:center;gap:8px\">\n          <button id=\"btnEliminarLeadsSeleccionados\" onclick=\"eliminarLeadsSeleccionados()\" class=\"jv-btn jv-btn-danger-solid\">Eliminar seleccionados</button>\n          <button onclick=\"cancelarSeleccionLeads()\" class=\"jv-btn jv-btn-ghost\">Cancelar</button>\n        </div>\n      </div>\n      <div id=\"adminLeadsList\" style=\"display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:10px\"></div>\n    </div>\n\n    <!-- TAB: Emails -->\n    <div class=\"jarvis-panel\" id=\"jarvisPanel-emails\" style=\"display:none\">\n      <div style=\"display:flex;align-items:center;justify-content:space-between;margin-bottom:20px\">\n        <div style=\"display:flex;align-items:center;gap:12px\">\n          <div style=\"width:40px;height:40px;border-radius:13px;background:linear-gradient(135deg,var(--jv-accent),var(--jv-accent-2));display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(255,95,46,.3)\">\n            <svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2\"><path d=\"M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z\"/><polyline points=\"22,6 12,13 2,6\"/></svg>\n          </div>\n          <div>\n            <div class=\"jv-title\">Correos enviados</div>\n            <div class=\"jv-title-sub\">Historial completo con contenido</div>\n          </div>\n        </div>\n        <span id=\"adminEmailsCount\" class=\"jv-chip\" style=\"background:rgba(255,95,46,.13);color:var(--jv-accent-2);border:1px solid rgba(255,95,46,.25);text-transform:none;letter-spacing:0;font-size:11.5px\"></span>\n      </div>\n      <div style=\"display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;align-items:center\">\n        <input id=\"emailFiltroTexto\" aria-label=\"Buscar email o asunto\" type=\"text\" placeholder=\"Buscar email, asunto o contenido...\" oninput=\"renderAdminEmails()\" style=\"flex:1;min-width:190px;background:var(--jv-glass);border:1px solid var(--jv-line);border-radius:999px;color:var(--jv-text);font-size:12.5px;padding:9px 16px;font-family:var(--jv-ui);font-weight:500;outline:none\">\n        <select id=\"emailFiltroTipo\" aria-label=\"Filtrar por tipo\" onchange=\"renderAdminEmails()\" class=\"jv-select\"><option value=\"\">Todos los tipos</option></select>\n        <select id=\"emailFiltroEstado\" aria-label=\"Filtrar por estado\" onchange=\"renderAdminEmails()\" class=\"jv-select\"><option value=\"\">Vistos y sin ver</option><option value=\"pendiente\">Solo sin ver</option><option value=\"gestionado\">Solo vistos</option></select>\n        <input id=\"emailFiltroDesde\" aria-label=\"Desde\" type=\"date\" onchange=\"renderAdminEmails()\" title=\"Desde esta fecha\" class=\"jv-date\">\n        <input id=\"emailFiltroHasta\" aria-label=\"Hasta\" type=\"date\" onchange=\"renderAdminEmails()\" title=\"Hasta esta fecha\" class=\"jv-date\">\n        <button onclick=\"limpiarFiltrosEmail()\" class=\"jv-btn jv-btn-ghost\">Limpiar</button>\n        <button onclick=\"eliminarEmailsFiltrados()\" title=\"Elimina todos los emails que coinciden con los filtros de arriba (útil para vaciar de golpe los digests acumulados)\" class=\"jv-btn jv-btn-danger-solid\">Eliminar filtrados</button>\n      </div>\n      <div style=\"display:flex;align-items:center;gap:8px;margin-bottom:10px\">\n        <label style=\"display:flex;align-items:center;gap:7px;font-size:12px;color:var(--jv-dim);font-family:var(--jv-ui);font-weight:600;cursor:pointer;user-select:none\">\n          <input type=\"checkbox\" id=\"emailSeleccionarTodos\" onchange=\"toggleSeleccionarTodosEmails(this.checked)\" style=\"accent-color:var(--jv-accent);width:15px;height:15px;cursor:pointer\">\n          Seleccionar todos\n        </label>\n      </div>\n      <div id=\"emailSeleccionBar\" style=\"display:none;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;background:rgba(255,95,46,.08);border:1px solid rgba(255,95,46,.25);border-radius:12px;padding:10px 16px;margin-bottom:10px\">\n        <span id=\"emailSeleccionCount\" style=\"font-size:12.5px;color:var(--jv-text);font-family:var(--jv-ui);font-weight:600\"></span>\n        <div style=\"display:flex;align-items:center;gap:8px\">\n          <button id=\"btnMarcarSeleccionados\" onclick=\"marcarSeleccionadosGestionados()\" class=\"jv-btn jv-btn-success\">Marcar como vistos</button>\n          <button id=\"btnEliminarSeleccionados\" onclick=\"eliminarSeleccionados()\" class=\"jv-btn jv-btn-danger-solid\">Eliminar seleccionados</button>\n          <button onclick=\"cancelarSeleccionEmails()\" class=\"jv-btn jv-btn-ghost\">Cancelar</button>\n        </div>\n      </div>\n      <div id=\"adminEmailsList\" style=\"display:flex;flex-direction:column;gap:8px\"></div>\n    </div>\n\n    <div id=\"adminEstado\" style=\"text-align:center;color:var(--metal);font-size:13px;padding:30px\"></div>\n  </div>\n</div>\n\n<!-- MODAL RENOVACIÓN MENSUAL -->\n<div class=\"modal-overlay\" id=\"modalRenovacion\">\n  <div class=\"modal-box\" style=\"max-width:500px;padding:32px\">\n    <div style=\"text-align:center;margin-bottom:8px\">\n      <svg viewBox=\"0 0 24 24\" width=\"36\" height=\"36\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><polyline points=\"23 4 23 10 17 10\"/><polyline points=\"1 20 1 14 7 14\"/><path d=\"M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15\"/></svg>\n    </div>\n    <div class=\"modal-title\" style=\"font-size:22px;text-align:center\">Nuevo mes, nuevo plan</div>\n    <p class=\"modal-desc\" style=\"text-align:center;margin-bottom:20px\">Tu suscripción se ha renovado. Vamos a actualizar tu plan con tus datos actuales.</p>\n\n    <div id=\"renovacionResumen\" style=\"background:var(--grafito);border:1px solid var(--humo);border-radius:10px;padding:16px;margin-bottom:20px\"></div>\n\n    <div style=\"margin-bottom:16px\">\n      <label for=\"renovPeso\" style=\"font-size:12px;color:var(--metal);font-family:'DM Mono',monospace;display:block;margin-bottom:6px\">PESO ACTUAL (kg)</label>\n      <div class=\"stepper-wrap\" style=\"max-width:200px\">\n        <button class=\"stepper-btn\" onclick=\"stepVal('renovPeso',-0.5)\" aria-label=\"Restar peso\">−</button>\n        <input type=\"number\" id=\"renovPeso\" min=\"40\" max=\"180\" step=\"0.5\" class=\"stepper-input\">\n        <span class=\"stepper-unit\">kg</span>\n        <button class=\"stepper-btn\" onclick=\"stepVal('renovPeso',0.5)\" aria-label=\"Sumar peso\">+</button>\n      </div>\n    </div>\n\n    <div style=\"margin-bottom:16px\">\n      <label style=\"font-size:12px;color:var(--metal);font-family:'DM Mono',monospace;display:block;margin-bottom:6px\">¿QUIERES CAMBIAR ALGO?</label>\n      <div style=\"display:flex;flex-direction:column;gap:6px\">\n        <label style=\"display:flex;align-items:center;gap:10px;font-size:13px;color:var(--blanco);cursor:pointer\">\n          <input type=\"checkbox\" id=\"renovCambiarObj\" style=\"accent-color:var(--brasa);width:16px;height:16px\"> Cambiar objetivo\n        </label>\n        <label style=\"display:flex;align-items:center;gap:10px;font-size:13px;color:var(--blanco);cursor:pointer\">\n          <input type=\"checkbox\" id=\"renovCambiarDeporte\" style=\"accent-color:var(--brasa);width:16px;height:16px\"> Cambiar deporte o días\n        </label>\n        <label style=\"display:flex;align-items:center;gap:10px;font-size:13px;color:var(--blanco);cursor:pointer\">\n          <input type=\"checkbox\" id=\"renovCambiarComida\" style=\"accent-color:var(--brasa);width:16px;height:16px\"> Cambiar alimentos no deseados\n        </label>\n      </div>\n    </div>\n\n    <div style=\"display:flex;gap:10px;margin-top:24px\">\n      <button class=\"btn-primary\" style=\"flex:1;padding:14px;font-size:14px;border-radius:10px\" onclick=\"confirmarRenovacion()\">Actualizar y generar plan →</button>\n    </div>\n    <button style=\"background:none;border:none;color:var(--metal);font-size:12px;cursor:pointer;margin-top:12px;width:100%;text-align:center\" onclick=\"cerrarRenovacion()\">Mantener plan actual</button>\n  </div>\n</div>\n\n<!-- MODAL DETALLE DE CLIENTE (Jarvis) -->\n<div id=\"modalJarvisCliente\" style=\"position:fixed;inset:0;z-index:10100;background:rgba(4,5,7,.72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);align-items:center;justify-content:center;padding:20px\" onclick=\"if(event.target===this)cerrarDetalleCliente()\">\n  <div style=\"position:relative;background:linear-gradient(180deg,#14161C,#0C0D11);border:1px solid var(--jv-line-hi);border-radius:22px;max-width:540px;width:100%;max-height:90vh;overflow-y:auto;padding:28px;box-shadow:0 32px 90px rgba(0,0,0,.6)\">\n    <div style=\"display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px\">\n      <div>\n        <div style=\"font-family:var(--jv-ui);font-weight:700;font-size:10.5px;color:var(--jv-accent-2);letter-spacing:.09em;text-transform:uppercase;margin-bottom:7px\">Detalle de cliente</div>\n        <div id=\"jcNombre\" style=\"font-family:var(--jv-display);font-size:23px;font-weight:800;letter-spacing:-.03em;color:var(--jv-text);line-height:1.15\"></div>\n        <div id=\"jcEmail\" style=\"font-size:12.5px;color:var(--jv-faint);margin-top:4px;font-weight:500\"></div>\n      </div>\n      <button onclick=\"cerrarDetalleCliente()\" aria-label=\"Cerrar\" style=\"background:var(--jv-glass);border:1px solid var(--jv-line);color:var(--jv-dim);font-size:15px;cursor:pointer;width:32px;height:32px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .15s\" onmouseenter=\"this.style.color='var(--jv-text)';this.style.borderColor='var(--jv-line-hi)'\" onmouseleave=\"this.style.color='var(--jv-dim)';this.style.borderColor='var(--jv-line)'\">✕</button>\n    </div>\n    <div id=\"jcBody\" style=\"display:grid;gap:10px\"></div>\n    <div style=\"margin-top:20px;text-align:right\">\n      <a id=\"jcMailto\" href=\"#\" style=\"display:inline-block;background:linear-gradient(135deg,var(--jv-accent),#E8471B);color:#fff;border-radius:11px;padding:10px 20px;font-size:13px;font-weight:700;text-decoration:none;font-family:var(--jv-ui);box-shadow:0 4px 16px rgba(255,95,46,.28)\">Enviar email</a>\n    </div>\n  </div>\n</div>");
  // Lo que index.html hace al cargar con los modales que ya existen (accesibilidad).
  document.querySelectorAll('#modalJarvisCliente, #modalAdmin .modal-overlay').forEach(el => {
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
  });
})();

async function marcarGestionado(msgId) {
  try {
    const { data: { session } } = await supa.auth.getSession();
    await fetch('/api/admin?fn=mensaje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ id: msgId, accion: 'gestionado' })
    });
    showToast('Mensaje marcado como gestionado');
    abrirPanelAdmin();
  } catch (e) { showToast('Error: ' + e.message, 4000); }
}

function toggleResponderJarvis(msgId) {
  const box = document.getElementById('responderBox-' + msgId);
  if (!box) return;
  const abrir = box.style.display === 'none';
  box.style.display = abrir ? '' : 'none';
  if (abrir) document.getElementById('responderTexto-' + msgId)?.focus();
}

// Guarda la respuesta en mensajes_respuestas (visible en la app para el
// cliente, como conversación) y manda el email en el mismo paso -- antes
// "Responder" solo abría Gmail con un correo suelto que nunca se guardaba.
async function enviarRespuestaJarvis(msgId) {
  const textarea = document.getElementById('responderTexto-' + msgId);
  const texto = (textarea?.value || '').trim();
  if (!texto) { showToast('Escribe una respuesta'); return; }
  const btn = document.getElementById('responderBtn-' + msgId);
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
  try {
    const { data: { session } } = await supa.auth.getSession();
    const res = await fetch('/api/admin?fn=mensaje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ id: msgId, accion: 'responder_mensaje', texto })
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || 'Error enviando la respuesta');
    showToast('Respuesta enviada — visible en la app y por email');
    abrirPanelAdmin();
  } catch (e) {
    showToast('Error: ' + e.message, 4000);
    if (btn) { btn.disabled = false; btn.textContent = 'Enviar'; }
  }
}

async function eliminarMensaje(msgId) {
  if (!confirm('¿Eliminar este mensaje?')) return;
  try {
    const { data: { session } } = await supa.auth.getSession();
    await fetch('/api/admin?fn=mensaje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ id: msgId, accion: 'eliminar' })
    });
    showToast('Mensaje eliminado');
    abrirPanelAdmin();
  } catch (e) { showToast('Error: ' + e.message, 4000); }
}

function mostrarFormAltaCliente() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay visible';
  modal.style.zIndex = '10200';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `
    <div class="modal-box" style="max-width:400px;padding:28px">
      <div class="modal-title" style="font-size:18px">Invitar cliente premium</div>
      <p class="modal-desc" style="margin-bottom:16px">Introduce el email del cliente. Cuando entre en k-one.fit con ese email tendrá acceso premium durante 1 año, sin pagar ni poner tarjeta. Si ya tiene cuenta, se le activa ahora y se cancela lo que tuviera en Stripe.</p>
      <div>
        <label style="font-size:11px;color:var(--metal);font-family:'DM Mono',monospace;display:block;margin-bottom:4px">EMAIL DEL CLIENTE</label>
        <input type="email" id="altaEmail" placeholder="cliente@email.com" style="width:100%;background:var(--grafito);border:1px solid var(--humo);color:var(--blanco);padding:12px 14px;font-size:14px;font-family:inherit;box-sizing:border-box;border-radius:8px">
      </div>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button class="btn-primary" style="flex:1;padding:12px;font-size:13px;border-radius:8px" onclick="ejecutarAltaCliente(this)">Invitar →</button>
        <button class="btn-ghost" style="flex:1;padding:12px;font-size:13px;border-radius:8px" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function ejecutarAltaCliente(btn) {
  const email = document.getElementById('altaEmail').value.trim().toLowerCase();
  if (!email || !email.includes('@')) { showToast('Pon un email válido'); return; }
  btn.disabled = true;
  btn.textContent = 'Invitando...';
  try {
    const { data: { session } } = await supa.auth.getSession();
    const res = await fetch('/api/admin?fn=crear-cliente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast(data.yaRegistrado
      ? `${email} ya tenía cuenta: premium activado ya${data.stripeCanceladas ? ' y su suscripción de Stripe cancelada' : ''}. No se le cobrará nada.`
      : `Invitación premium guardada para ${email}. Al entrar en K-ONE tendrá el premium sin pagar.`, 6000);
    btn.closest('.modal-overlay').remove();
    abrirPanelAdmin();
  } catch (e) {
    showToast('Error: ' + e.message, 5000);
    btn.disabled = false;
    btn.textContent = 'Invitar →';
  }
}

function jarvisTab(tab) {
  document.querySelectorAll('.jarvis-panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.jarvis-tab').forEach(t => t.classList.remove('jarvis-tab-active'));
  const panel = document.getElementById('jarvisPanel-' + tab);
  if (panel) panel.style.display = '';
  const tabs = document.querySelectorAll('.jarvis-tab');
  const idx = { dashboard: 0, clientes: 1, buzon: 2, leads: 3, emails: 4 }[tab];
  if (tabs[idx]) tabs[idx].classList.add('jarvis-tab-active');
}

function cerrarPanelAdmin() {
  const m = document.getElementById('modalAdmin');
  if (m) m.style.display = 'none';
}

// Estado del panel
let _adminDatos = null;
let _adminFiltro = { texto: '', tipo: 'todos' };
let _adminSort   = { col: 'alta', dir: -1 };
let _adminEmailLog = [];
// Selección múltiple en las pestañas Emails/Buzón/Leads (marcar/eliminar varios a la vez).
let _emailsSeleccionados = new Set();
let _adminEmailsFiltradosIds = [];
let _adminMensajes = [];
let _mensajesSeleccionados = new Set();
let _adminMensajesIds = [];
let _adminLeads = [];
let _leadsSeleccionados = new Set();
let _adminLeadsIds = [];

// Tiempo relativo compacto para "última conexión": "Ahora", "hace 3 h", "hace 2 d", "hace 5 sem".
const _fmtRelativo = (iso) => {
  if (!iso) return 'Nunca';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'Ahora';
  const min = Math.floor(ms / 60000);
  if (min < 2) return 'Ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} d`;
  const sem = Math.floor(d / 7);
  if (sem < 5) return `hace ${sem} sem`;
  const mes = Math.floor(d / 30);
  if (mes < 12) return `hace ${mes} mes${mes > 1 ? 'es' : ''}`;
  return `hace ${Math.floor(d / 365)} año${Math.floor(d / 365) > 1 ? 's' : ''}`;
};
// Color según antigüedad: verde reciente, gris medio, ámbar si lleva mucho.
const _colorConexion = (iso) => {
  if (!iso) return 'var(--jv-faint)';
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d <= 3) return 'var(--jv-ok)';
  if (d <= 14) return 'var(--jv-dim)';
  return '#FF9556';
};
// Estado como píldora con punto: el color de fondo y el punto hacen que el
// estado se lea de un vistazo recorriendo la columna, sin leer la palabra.
const _estadoPill = (txt, rgb) =>
  `<span class="jv-chip" style="background:rgba(${rgb},.13);color:rgb(${rgb});border:1px solid rgba(${rgb},.26)">` +
  `<span style="width:5px;height:5px;border-radius:50%;background:rgb(${rgb});flex-shrink:0"></span>${txt}</span>`;
const _estadoLegible = (c) => {
  // 'premium' lo pone api/admin-clientes.js para un premium vigente: manda
  // sobre lo que diga Stripe (no paga nada, aunque quede una fila vieja).
  if (c.estado === 'premium') return _estadoPill('Premium', '255,197,61');
  if (c.enOferta)    return _estadoPill('Oferta 1,99€', '255,197,61');
  if (c.estado === 'past_due') return _estadoPill('Pago fallido', '255,94,94');
  if (c.cancelaAlFinal) return _estadoPill('Cancela al final', '255,149,86');
  if (c.estado === 'trialing') return _estadoPill('Mes gratis', '82,169,255');
  if (c.estado === 'active') return _estadoPill('Pagando', '61,220,151');
  if (['canceled','unpaid'].includes(c.estado)) return _estadoPill('Cancelado', '93,98,112');
  return _estadoPill('Sin pago', '93,98,112');
};

async function _abrirPanelAdminReal() {
  const m = document.getElementById('modalAdmin');
  if (m) m.style.display = 'block';
  if (typeof actualizarBotonNotificaciones === 'function') actualizarBotonNotificaciones();
  const estado = document.getElementById('adminEstado');
  if (estado) estado.textContent = 'Cargando datos...';
  ['adminAccion','adminMetricsBiz','adminMetricsTrend','adminMetricsEng','adminMetricsAlt','adminDist','adminTabla']
    .forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
  try {
    const { data: { session } } = await supa.auth.getSession();
    if (!session) throw new Error('Sesión caducada. Vuelve a entrar.');
    const res = await fetch('/api/admin?fn=clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'No se pudieron cargar los datos');
    _adminDatos = data;
    _adminFiltro = { texto: '', tipo: 'todos' };
    _adminSort   = { col: 'alta', dir: -1 };
    const buscador = document.getElementById('adminBuscador');
    if (buscador) buscador.value = '';
    _activarFiltroBtn('todos');
    renderPanelAdmin(data);
    if (estado) estado.textContent = data.clientes.length ? '' : 'Aún no hay clientes registrados.';
    // El servidor pone al día el premium al abrir Jarvis (api/_premium.js):
    // se avisa solo cuando de verdad ha cambiado algo.
    const pr = data.premiumReconciliado;
    if (pr && (pr.aplicadas.length || pr.stripeCanceladas)) {
      const partes = [];
      if (pr.aplicadas.length) partes.push(`premium activado a ${pr.aplicadas.join(', ')}`);
      if (pr.stripeCanceladas) partes.push(`${pr.stripeCanceladas} suscripción${pr.stripeCanceladas === 1 ? '' : 'es'} de Stripe de clientes premium cancelada${pr.stripeCanceladas === 1 ? '' : 's'}`);
      showToast('Premium al día: ' + partes.join(' y ') + '. No se les cobrará nada.', 8000);
    } else if (pr && pr.avisos && pr.avisos.length) {
      showToast('Premium: ' + pr.avisos[0], 8000);
    }
    const ts = document.getElementById('adminTimestamp');
    if (ts) ts.textContent = 'Actualizado ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    if (estado) estado.textContent = 'Error: ' + e.message;
  }
}

// ===== JARVIS: predicados de acción (compartidos por el centro de acción y el filtro de tabla) =====
const _diasDesde = (iso) => iso ? (Date.now() - new Date(iso).getTime()) / 86400000 : null;
const _accPagoFallido  = c => c.estado === 'past_due';
const _accSinEntrenar  = c => ['active','trialing','premium'].includes(c.estado) && (c.entrenosTotal || 0) === 0;
const _accInactivo     = c => { const d = c.ultimaConexion ? _diasDesde(c.ultimaConexion) : (c.diasDesdeAlta ?? 999); return c.onboarding && d > 14; };
const _accPremiumCaduca = c => c.isBeta && c.betaExpires && (new Date(c.betaExpires).getTime() - Date.now()) < 7 * 86400000;
const _accCancela      = c => !!c.cancelaAlFinal;
// Hallazgo del agente de auditoría diario (api/notify.js): alimento que el
// cliente no puede o no quiere comer, colado en su plan guardado.
const _accRevisarPlan  = c => !!(c.auditoriaHallazgos && c.auditoriaHallazgos.length);
const _accRenueva7     = c => ['active','trialing'].includes(c.estado) && !c.cancelaAlFinal && c.renovacion && (() => { const ms = new Date(c.renovacion).getTime() - Date.now(); return ms > 0 && ms < 7 * 86400000; })();

// Health score 0-100: cruza pago + conexión + entrenos + onboarding. Menor = más riesgo de baja.
function _healthScore(c) {
  let s = 100;
  if (c.estado === 'past_due') s -= 35;
  else if (['canceled','unpaid'].includes(c.estado)) s -= 50;
  else if (!['active','trialing'].includes(c.estado) && !c.isBeta) s -= 15;
  if (c.cancelaAlFinal) s -= 30; // señal de baja más fuerte: ya ha pedido no renovar
  const d = c.ultimaConexion ? _diasDesde(c.ultimaConexion) : (c.diasDesdeAlta ?? 999);
  if (d > 30) s -= 30; else if (d > 14) s -= 20; else if (d > 7) s -= 10;
  if ((c.entrenosTotal || 0) === 0) s -= 20; else if (c.entrenosTotal <= 3) s -= 5;
  if (!c.onboarding) s -= 15;
  s = Math.max(0, Math.min(100, s));
  const color = s >= 75 ? 'var(--jv-ok)' : s >= 50 ? 'var(--jv-warn)' : 'var(--jv-bad)';
  const rgb   = s >= 75 ? '61,220,151'   : s >= 50 ? '255,197,61'    : '255,94,94';
  const label = s >= 75 ? 'Saludable' : s >= 50 ? 'Atención' : 'Riesgo de baja';
  return { score: s, color, rgb, label };
}

// Salta a la lista de clientes con un filtro concreto desde una tarjeta de acción.
function accionIrClientes(tipo) {
  jarvisTab('clientes');
  filtrarAdminTipo(tipo);
}

// Centro de acción diaria: qué requiere tu atención hoy, cada punto clicable.
function renderCentroAccion(data) {
  const cont = document.getElementById('adminAccion');
  if (!cont) return;
  const clientes = data.clientes || [];
  const sinResponder = (data.mensajes || []).filter(m => !m.respuesta).length;

  const items = [
    // Lo primero: es seguridad alimentaria, no una métrica de negocio.
    { n: clientes.filter(_accRevisarPlan).length,   label: 'Plan con alimento prohibido', sub: 'Revisar y regenerar', color: 'var(--jv-bad)',  rgb: '255,94,94',   tipo: 'revisar' },
    { n: clientes.filter(_accPagoFallido).length,   label: 'Pago fallido',        sub: 'Reintentando cobro',      color: 'var(--jv-bad)',  rgb: '255,94,94',   tipo: 'past_due' },
    { n: clientes.filter(_accCancela).length,        label: 'Cancela al vencer',   sub: 'Se van al renovar',       color: '#FF9556',        rgb: '255,149,86',  tipo: 'cancela' },
    { n: clientes.filter(_accPremiumCaduca).length,  label: 'Premium por caducar', sub: 'Próximos 7 días',         color: 'var(--jv-warn)', rgb: '255,197,61',  tipo: 'premiumcaduca' },
    { n: clientes.filter(_accInactivo).length,       label: 'Inactivos +14 días',  sub: 'Sin abrir la web',        color: '#FF9556',        rgb: '255,149,86',  tipo: 'inactivos' },
    { n: clientes.filter(_accSinEntrenar).length,    label: 'Sin entrenar',        sub: '0 entrenos, en prueba o pagando', color: 'var(--jv-warn)', rgb: '255,197,61',  tipo: 'sinentrenar' },
    { n: clientes.filter(_accRenueva7).length,       label: 'Renuevan en 7 días',  sub: 'Cobro próximo',           color: 'var(--jv-info)', rgb: '82,169,255',  tipo: 'renueva7' },
    { n: sinResponder,                               label: 'Mensajes sin responder', sub: 'En el buzón',          color: 'var(--jv-alt)',  rgb: '167,139,250', tipo: '__buzon' },
  ].filter(it => it.n > 0);

  if (items.length === 0) {
    cont.innerHTML = `<div class="jv-card" style="padding:20px 22px;display:flex;align-items:center;gap:14px;background:linear-gradient(120deg,rgba(61,220,151,.09),var(--jv-glass));border-color:rgba(61,220,151,.22)">
      <div style="width:38px;height:38px;border-radius:12px;background:rgba(61,220,151,.14);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--jv-ok)" stroke-width="2.2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      </div>
      <div>
        <div style="font-family:var(--jv-display);color:var(--jv-text);font-weight:700;font-size:15px;letter-spacing:-.02em">Todo en orden</div>
        <div style="color:var(--jv-faint);font-size:12.5px;margin-top:2px;font-weight:500">Ningún cliente requiere atención urgente ahora mismo.</div>
      </div>
    </div>`;
    return;
  }

  const total = items.reduce((a, it) => a + it.n, 0);
  const cards = items.map(it => {
    const onclick = it.tipo === '__buzon' ? "jarvisTab('buzon')" : `accionIrClientes('${it.tipo}')`;
    // El color de cada aviso tiñe el borde, el resplandor del hover y la
    // cifra: la severidad se lee antes que el texto.
    return `<button class="jv-action" onclick="${onclick}" style="border-color:rgba(${it.rgb},.28)"
      onmouseenter="this.style.borderColor='rgba(${it.rgb},.55)';this.style.boxShadow='0 12px 30px rgba(${it.rgb},.16)'"
      onmouseleave="this.style.borderColor='rgba(${it.rgb},.28)';this.style.boxShadow='none'">
      <div class="jv-action-n" style="color:${it.color}">${it.n}</div>
      <div class="jv-action-l">${it.label}</div>
      <div class="jv-action-s">${it.sub}</div>
    </button>`;
  }).join('');

  cont.innerHTML = `
    <div class="jv-head">
      <span class="jv-head-bar"></span>
      <span class="jv-head-txt">Requiere tu atención hoy</span>
      <span class="jv-head-meta">${total} en total</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(162px,1fr));gap:11px">${cards}</div>`;
}

function renderPanelAdmin(data) {
  const mt = data.metrics || {};

  renderCentroAccion(data);

  const renderCards = (id, cards) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = cards.map(c => `
      <div class="jv-card jv-metric">
        <div class="jv-metric-label">${c.label}</div>
        <div class="jv-metric-val" style="color:${c.color}">${c.valor}</div>
        ${c.sub ? `<div class="jv-metric-sub">${c.sub}</div>` : ''}
      </div>`).join('');
  };

  // Gris apagado para los ceros: una alerta a 0 no debe competir
  // visualmente con una que sí tiene algo que atender.
  const OFF = 'var(--jv-faint)';

  // — Negocio —
  renderCards('adminMetricsBiz', [
    // Desde el 4 oct 2026 "pagando" es solo quien ya paga: el mes gratis va aparte.
    { label: 'Ingresos al mes', valor: (mt.mrrEstimado != null ? mt.mrrEstimado.toFixed(2).replace('.', ',') : '0') + ' €', color: 'var(--jv-accent-2)',
      sub: mt.mrrPotencial > 0 ? `+${mt.mrrPotencial.toFixed(2).replace('.', ',')} € si pagan los que están en prueba` : 'Solo quien ya paga' },
    { label: 'Pagando', valor: mt.activosPago || 0, color: (mt.activosPago || 0) > 0 ? 'var(--jv-ok)' : OFF,
      sub: mt.tasaConversion == null ? 'Aún no ha terminado ninguna prueba' : `${mt.tasaConversion}% de las pruebas terminadas (${mt.activosPago || 0} de ${mt.pruebasTerminadas || 0})` },
    { label: 'En mes gratis', valor: mt.enPrueba || 0, color: (mt.enPrueba || 0) > 0 ? 'var(--jv-info)' : OFF, sub: 'Todavía no pagan' },
    { label: 'Premium (no pagan)', valor: mt.premium || 0, color: (mt.premium || 0) > 0 ? 'var(--jv-warn)' : OFF },
    { label: 'Total registrados', valor: mt.registrados || 0, color: 'var(--jv-text)' },
  ]);

  // — Esta semana vs anterior —
  const trendColor = (n, p) => n > p ? 'var(--jv-ok)' : n < p ? 'var(--jv-bad)' : OFF;
  const trendArrow = (n, p) => n > p ? ' ↑' : n < p ? ' ↓' : '';
  const nReg = mt.nuevosEstaSemana || 0, pReg = mt.nuevosSemanaPasada || 0;
  renderCards('adminMetricsTrend', [
    { label: 'Nuevos registros', valor: nReg + trendArrow(nReg, pReg), color: trendColor(nReg, pReg), sub: `${pReg} semana anterior` },
    { label: 'Cobros esta semana', valor: mt.nuevosPagosEstaSemana || 0, color: (mt.nuevosPagosEstaSemana || 0) > 0 ? 'var(--jv-ok)' : OFF },
  ]);

  // — Embudo & Engagement —
  renderCards('adminMetricsEng', [
    { label: 'Completaron onboarding', valor: mt.onboardingCompletado || 0, color: 'var(--jv-text)', sub: `de ${mt.registrados || 0} registrados` },
    { label: 'Días hasta el primer pago', valor: mt.tiempoMedioPago != null ? mt.tiempoMedioPago + ' días' : '—', color: 'var(--jv-text)' },
    { label: 'Media de entrenos', valor: String(mt.mediaEntrenos || 0).replace('.', ','), color: 'var(--jv-ok)', sub: 'En prueba, pagando o premium' },
    { label: 'Sin entrenar', valor: mt.ceroEntrenosActivos || 0, color: mt.ceroEntrenosActivos > 0 ? '#FF9556' : OFF },
  ]);

  // — Alertas operativas —
  renderCards('adminMetricsAlt', [
    { label: 'Pago fallido', valor: mt.pagoFallido || 0, color: mt.pagoFallido > 0 ? 'var(--jv-bad)' : OFF },
    { label: 'Cancelan al final', valor: mt.cancelanAlFinal || 0, color: mt.cancelanAlFinal > 0 ? '#FF9556' : OFF },
    { label: 'Renuevan en 7 días', valor: mt.renovacionProximos7d || 0, color: mt.renovacionProximos7d > 0 ? 'var(--jv-warn)' : OFF },
    { label: '+14 días sin onboarding', valor: mt.sinOnboarding14d || 0, color: mt.sinOnboarding14d > 0 ? 'var(--jv-bad)' : OFF },
    { label: 'Sin suscripción', valor: mt.sinSuscripcion || 0, color: OFF },
    { label: 'Cancelados total', valor: mt.cancelados || 0, color: OFF },
  ]);

  // — Distribuciones + Retención —
  const distEl = document.getElementById('adminDist');
  if (distEl) {
    const totalClientes = data.clientes.length;
    // Barra de proporción: raíl tenue + relleno con degradado. El degradado
    // (no un plano) es lo que hace que se lea como un gráfico cuidado y no
    // como un div de color.
    const barra = (label, count, pct, grad) => `
      <div style="margin-bottom:11px">
        <div style="display:flex;justify-content:space-between;gap:10px;font-size:12.5px;margin-bottom:5px">
          <span style="color:var(--jv-dim);font-weight:500;min-width:0">${label}</span>
          <span style="color:var(--jv-faint);font-weight:600;font-variant-numeric:tabular-nums;flex-shrink:0">${count} · ${pct}%</span>
        </div>
        <div style="background:rgba(255,255,255,.06);border-radius:999px;height:6px;overflow:hidden">
          <div style="background:${grad};height:100%;width:${pct}%;border-radius:999px;transition:width .5s cubic-bezier(.2,.7,.3,1)"></div>
        </div>
      </div>`;

    const GRAD_ACC = 'linear-gradient(90deg,var(--jv-accent),var(--jv-accent-2))';
    const GRAD_OK  = 'linear-gradient(90deg,#2FB57C,var(--jv-ok))';

    const renderDist = (titulo, items, tot) => {
      if (!items || items.length === 0) return '';
      const barras = items.map(it => {
        const pct = tot > 0 ? Math.round((it.count / tot) * 100) : 0;
        return barra(_esc(it.label), it.count, pct, GRAD_ACC);
      }).join('');
      return `<div class="jv-card" style="padding:17px 19px">
        <div class="jv-metric-label" style="margin-bottom:14px">${titulo}</div>
        ${barras}</div>`;
    };

    // Retención (clientes activos por semana del plan)
    const ret = data.retencion || {};
    const totalRet = (ret['1']||0)+(ret['2']||0)+(ret['3']||0)+(ret['4+']||0);
    const retItems = [
      { label: 'Semana 1', count: ret['1']||0 },
      { label: 'Semana 2', count: ret['2']||0 },
      { label: 'Semana 3', count: ret['3']||0 },
      { label: 'Semana 4+', count: ret['4+']||0 },
    ];
    const retBarras = retItems.map(it => {
      const pct = totalRet > 0 ? Math.round((it.count / totalRet) * 100) : 0;
      return barra(it.label, it.count, pct, it.label === 'Semana 4+' ? GRAD_OK : GRAD_ACC);
    }).join('');
    const retCard = `<div class="jv-card" style="padding:17px 19px">
      <div class="jv-metric-label" style="margin-bottom:4px">Retención por semana</div>
      <div style="font-size:12px;color:var(--jv-faint);margin-bottom:14px;font-weight:500">Los activos en semana 4+ rara vez cancelan</div>
      ${retBarras}</div>`;

    // Motivos de baja agregados (12 sept 2026): antes solo se veía uno a
    // uno en la ficha de cada cliente; esto junta todos para detectar de
    // un vistazo si la mayoría se va por lo mismo (precio, dieta...). El
    // % es sobre quienes contestaron, no sobre el total de clientes --
    // mezclar los dos denominadores haría parecer el problema más pequeño
    // de lo que es.
    // Origen de los registros (4 oct 2026): de dónde vienen y cuántos de cada
    // origen han entrenado y pagan. Así se ve si una campaña trae clientes o solo clics.
    const conOrigen = (data.clientes || []).filter(c => c.origen && c.origen.fuente);
    const porOrigen = {};
    conOrigen.forEach(c => {
      const k = c.origenTexto || c.origen.fuente;
      const o = porOrigen[k] || (porOrigen[k] = { n: 0, entrenan: 0, pagan: 0 });
      o.n++; if ((c.entrenosTotal || 0) > 0) o.entrenan++; if (c.estado === 'active') o.pagan++;
    });
    const origenCard = conOrigen.length
      ? `<div class="jv-card" style="padding:17px 19px">
          <div class="jv-metric-label" style="margin-bottom:4px">De dónde vienen</div>
          <div style="font-size:12px;color:var(--jv-faint);margin-bottom:14px;font-weight:500">${conOrigen.length} registro${conOrigen.length === 1 ? '' : 's'} con origen (desde el 4 oct 2026)</div>
          ${Object.entries(porOrigen).sort((a, b) => b[1].n - a[1].n).map(([k, o]) =>
            barra(_esc(k) + ' · ' + o.entrenan + ' entrenan · ' + o.pagan + ' pagan', o.n, Math.round(o.n / conOrigen.length * 100), GRAD_ACC)).join('')}
        </div>`
      : '';
    const distMotivoBaja = data.distMotivoBaja || [];
    const totalBajas = distMotivoBaja.reduce((s, it) => s + it.count, 0);
    const bajaCard = totalBajas > 0
      ? `<div class="jv-card" style="padding:17px 19px">
          <div class="jv-metric-label" style="margin-bottom:4px">Motivos de baja</div>
          <div style="font-size:12px;color:var(--jv-faint);margin-bottom:14px;font-weight:500">${totalBajas} cliente${totalBajas===1?'':'s'} que cancelaron nos dijeron por qué</div>
          ${distMotivoBaja.map(it => {
            const pct = Math.round((it.count / totalBajas) * 100);
            return barra(_esc(MOTIVOS_LABEL[it.label] || it.label), it.count, pct, it.label === 'sin_respuesta' ? 'linear-gradient(90deg,#5A5A5A,#7A7A7A)' : GRAD_ACC);
          }).join('')}
        </div>`
      : '';

    distEl.innerHTML =
      renderDist('Deporte', data.distDeporte, totalClientes) +
      renderDist('Objetivo', data.distObjetivo, totalClientes) +
      renderDist('Tipo de plan', data.distPlan, totalClientes) +
      retCard + bajaCard + origenCard;
  }

  // — Totales en cabecera de tabla —
  const totalEl = document.getElementById('adminTotalClientes');
  if (totalEl) totalEl.textContent = data.clientes.length;

  renderTablaAdmin();

  // Emails enviados — se guardan y se renderizan con filtros (ver renderAdminEmails)
  _adminEmailLog = data.emailLog || [];
  poblarFiltroTipoEmail();
  renderAdminEmails();

  // Mensajes de clientes y leads: se guardan y se renderizan aparte (ver
  // renderAdminMensajes/renderAdminLeads) para poder refrescar solo esa
  // lista tras una acción en bloque, igual que ya hacía renderAdminEmails.
  _adminMensajes = data.mensajes || [];
  renderAdminMensajes();
  _adminLeads = data.leads || [];
  renderAdminLeads();
}

function renderAdminMensajes() {
  const mensajes = _adminMensajes;
  const sinResponder = mensajes.filter(m => !m.respuesta).length;
  const mensajesCount = document.getElementById('adminMensajesCount');
  if (mensajesCount) {
    mensajesCount.textContent = mensajes.length + ' mensajes' + (sinResponder ? ` · ${sinResponder} sin responder` : '');
  }
  const buzonBadge = document.getElementById('jarvisBuzonBadge');
  if (buzonBadge) {
    buzonBadge.style.display = sinResponder > 0 ? '' : 'none';
    buzonBadge.textContent = sinResponder;
  }
  _adminMensajesIds = mensajes.filter(m => m.id != null).map(m => String(m.id));
  const _mIdsSet = new Set(_adminMensajesIds);
  _mensajesSeleccionados.forEach(id => { if (!_mIdsSet.has(id)) _mensajesSeleccionados.delete(id); });
  const mensajesList = document.getElementById('adminMensajesList');
  if (mensajesList) {
    const fmtMsgHora = (iso) => iso ? new Date(iso).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}) : '';
    mensajesList.innerHTML = mensajes.length === 0
      ? '<p style="color:var(--jv-faint);font-size:13px">No hay mensajes de clientes.</p>'
      : mensajes.map(m => {
        const pendiente = !m.respuesta;
        // Iconos SVG de línea, no emoji (regla de diseño del proyecto).
        const _svgIcoMsg = (path) => `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px" aria-hidden="true">${path}</svg>`;
        const _icoChat = _svgIcoMsg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>');
        const motivoIcons = {
          'Sugerencia': _svgIcoMsg('<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.7 10.7c.5.4.7 1 .7 1.6V16h6v-.7c0-.6.3-1.2.7-1.6A6 6 0 0 0 12 3z"/>'),
          'Alimento': _svgIcoMsg('<path d="M3 2v7c0 1.1.9 2 2 2s2-.9 2-2V2"/><line x1="5" y1="2" x2="5" y2="22"/><path d="M19 2c-1.7 0-3 2-3 5.5S17.3 13 19 13v9"/>'),
          'Ejercicio': _svgIcoMsg('<path d="M6.5 6.5a2.5 2.5 0 1 1 3.5 3.5l-6 6-3.5-3.5 6-6z"/><path d="M17.5 6.5a2.5 2.5 0 1 0-3.5 3.5l6 6 3.5-3.5-6-6z"/><line x1="8" y1="8" x2="16" y2="16"/>'),
          'Mi plan': _svgIcoMsg('<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9 3h6v3a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V3z"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="15" y2="16"/>'),
          'Pago': _svgIcoMsg('<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>'),
          'Otro': _icoChat
        };
        const motivoIcon = motivoIcons[m.asunto] || _icoChat;
        const seleccionable = m.id != null;
        const seleccionado = seleccionable && _mensajesSeleccionados.has(String(m.id));
        // Mismo escapado que ya usa el checkbox de más abajo -- m.id es un
        // uuid de Supabase, así que hoy no hay ningún valor real que rompa
        // el atributo, pero es defensa en profundidad barata si esa
        // columna dejara de ser una PK estricta.
        const mIdJs = String(m.id).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return `
        <div id="mensaje-row-${m.id}" style="background:var(--jv-glass);border:1px solid ${seleccionado ? 'var(--jv-accent)' : pendiente ? 'rgba(255,95,46,0.19)' : 'var(--jv-line)'};border-radius:12px;overflow:hidden;transition:all .15s">
          <div style="padding:16px 18px">
            <div style="display:flex;align-items:flex-start;gap:14px">
              ${seleccionable
                ? '<input type="checkbox" ' + (seleccionado ? 'checked ' : '') + 'aria-label="Seleccionar mensaje de ' + _esc(m.nombre || m.email || '') + '" onchange="toggleSeleccionMensaje(\'' + String(m.id).replace(/\\/g,'\\\\').replace(/'/g,"\\'") + '\',this.checked)" style="width:16px;height:16px;flex-shrink:0;margin-top:12px;accent-color:var(--jv-accent);cursor:pointer">'
                : '<span style="width:16px;flex-shrink:0"></span>'}
              <div style="width:40px;height:40px;border-radius:10px;background:${pendiente ? 'linear-gradient(135deg,var(--jv-accent),var(--jv-accent-2))' : 'var(--jv-glass-hi)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px">
                ${pendiente ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--jv-text)" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>' : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--jv-ok)" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'}
              </div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
                  <span style="font-size:14px;font-weight:600;color:var(--jv-text)">${_esc(m.nombre)}</span>
                  <span style="font-size:10px;padding:2px 7px;border-radius:4px;background:${pendiente ? 'rgba(255,95,46,0.09)' : 'rgba(61,220,151,0.09)'};color:${pendiente ? 'var(--jv-accent)' : 'var(--jv-ok)'};font-family:var(--jv-ui);font-weight:600;font-weight:600">${pendiente ? 'PENDIENTE' : 'GESTIONADO'}</span>
                </div>
                <div style="font-size:11px;color:var(--jv-faint);display:flex;align-items:center;gap:6px;font-family:var(--jv-ui);font-weight:600">
                  <span>${_esc(m.email)}</span>
                  <span style="color:var(--jv-line)">·</span>
                  <span>${_fmtFecha(m.created_at)}</span>
                  <span style="color:var(--jv-line)">·</span>
                  <span>${fmtMsgHora(m.created_at)}</span>
                </div>
              </div>
            </div>
            <div style="margin:12px 0 0 54px">
              <div style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--jv-accent);font-weight:600;margin-bottom:8px;background:rgba(255,95,46,0.06);padding:3px 10px;border-radius:6px">
                <span>${motivoIcon}</span> ${_esc(m.asunto)}
              </div>
              <div style="background:rgba(0,0,0,.3);border:1px solid var(--jv-line);border-radius:8px;padding:12px 14px;font-size:13px;color:var(--jv-dim);line-height:1.6;white-space:pre-wrap;word-break:break-word">${_esc(m.mensaje)}</div>
              ${(m.mensajes_respuestas || []).length ? `
              <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">
                ${[...m.mensajes_respuestas].sort((a,b) => new Date(a.created_at) - new Date(b.created_at)).map(r => `
                <div style="background:${r.autor === 'admin' ? 'rgba(255,95,46,0.06)' : 'rgba(0,0,0,.3)'};border:1px solid var(--jv-line);border-radius:8px;padding:10px 14px">
                  <div style="font-size:10px;font-weight:700;color:${r.autor === 'admin' ? 'var(--jv-accent)' : 'var(--jv-faint)'};text-transform:uppercase;letter-spacing:.03em;margin-bottom:4px">${r.autor === 'admin' ? 'Tú (K-ONE)' : _esc(m.nombre)} · ${_fmtFecha(r.created_at)}</div>
                  <div style="font-size:12.5px;color:var(--jv-dim);line-height:1.6;white-space:pre-wrap;word-break:break-word">${_esc(r.texto)}</div>
                </div>`).join('')}
              </div>` : ''}
            </div>
          </div>
          <div id="responderBox-${m.id}" style="display:none;border-top:1px solid var(--jv-line);padding:14px 18px;background:rgba(0,0,0,.2)">
            <textarea id="responderTexto-${m.id}" placeholder="Escribe tu respuesta... se guarda en la app y se envía por email" aria-label="Respuesta a ${_esc(m.nombre)}" style="width:100%;min-height:80px;background:rgba(0,0,0,.3);border:1px solid var(--jv-line);border-radius:8px;padding:10px 12px;color:var(--jv-text);font-family:inherit;font-size:13px;resize:vertical;box-sizing:border-box"></textarea>
            <div style="display:flex;gap:8px;margin-top:8px">
              <button id="responderBtn-${m.id}" onclick="event.stopPropagation();enviarRespuestaJarvis('${mIdJs}')" class="jv-btn jv-btn-accent" style="padding:7px 14px;font-size:11px">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                Enviar
              </button>
              <button onclick="event.stopPropagation();toggleResponderJarvis('${mIdJs}')" class="jv-btn jv-btn-ghost" style="padding:7px 14px;font-size:11px">Cancelar</button>
            </div>
          </div>
          <div style="border-top:1px solid var(--jv-line);padding:10px 18px;display:flex;align-items:center;gap:8px;background:rgba(0,0,0,.28)">
            <button onclick="event.stopPropagation();toggleResponderJarvis('${mIdJs}')" class="jv-btn jv-btn-accent" style="padding:7px 14px;font-size:11px">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
              Responder
            </button>
            ${pendiente ? `
              <button onclick="event.stopPropagation();marcarGestionado('${mIdJs}')" class="jv-btn jv-btn-success" style="padding:7px 14px;font-size:11px">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                Gestionado
              </button>` : ''}
            <button onclick="event.stopPropagation();eliminarMensaje('${mIdJs}')" class="jv-btn jv-btn-danger" style="padding:6px 12px;font-size:11px;margin-left:auto">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              Eliminar
            </button>
          </div>
        </div>`;
      }).join('');
  }
  _actualizarBarraSeleccionMensajes();
}

function renderAdminLeads() {
  const leads = _adminLeads;
  const leadsCount = document.getElementById('adminLeadsCount');
  if (leadsCount) leadsCount.textContent = leads.length + ' leads';
  _adminLeadsIds = leads.filter(l => l.id != null).map(l => String(l.id));
  const _lIdsSet = new Set(_adminLeadsIds);
  _leadsSeleccionados.forEach(id => { if (!_lIdsSet.has(id)) _leadsSeleccionados.delete(id); });
  const leadsList = document.getElementById('adminLeadsList');
  if (leadsList) {
    const fmtLeadHora = (iso) => iso ? new Date(iso).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}) : '';
    const ahora = Date.now();
    leadsList.innerHTML = leads.length === 0
      ? '<p style="color:var(--jv-faint);font-size:13px;grid-column:1/-1">Aún no hay leads registrados.</p>'
      : leads.map(l => {
        const horasDesde = Math.floor((ahora - new Date(l.created_at).getTime()) / 3600000);
        const esReciente = horasDesde < 24;
        const seleccionable = l.id != null;
        const seleccionado = seleccionable && _leadsSeleccionados.has(String(l.id));
        return `
        <div id="lead-row-${l.id}" style="background:var(--jv-glass);border:1px solid ${seleccionado ? 'var(--jv-accent)' : esReciente ? 'rgba(255,95,46,0.19)' : 'var(--jv-line)'};border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:14px;transition:all .2s" onmouseenter="this.style.background='var(--jv-glass-hi)';this.style.transform='translateY(-1px)'" onmouseleave="this.style.background='var(--jv-glass)';this.style.transform='none'">
          ${seleccionable
            ? '<input type="checkbox" ' + (seleccionado ? 'checked ' : '') + 'aria-label="Seleccionar lead ' + _esc(l.email || '') + '" onchange="toggleSeleccionLead(\'' + String(l.id).replace(/\\/g,'\\\\').replace(/'/g,"\\'") + '\',this.checked)" style="width:16px;height:16px;flex-shrink:0;accent-color:var(--jv-accent);cursor:pointer">'
            : '<span style="width:16px;flex-shrink:0"></span>'}
          <div style="width:36px;height:36px;border-radius:10px;background:${esReciente ? 'linear-gradient(135deg,var(--jv-accent),var(--jv-accent-2))' : 'var(--jv-glass-hi)'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="${esReciente ? 'var(--jv-text)' : 'var(--jv-faint)'}" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;color:var(--jv-text);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(l.email)}</div>
            <div style="font-size:10px;color:var(--jv-faint);font-family:var(--jv-ui);font-weight:600;margin-top:3px;display:flex;align-items:center;gap:6px">
              <span>${_fmtFecha(l.created_at)}</span>
              <span style="color:var(--jv-line)">·</span>
              <span>${fmtLeadHora(l.created_at)}</span>
              ${esReciente ? '<span style="color:var(--jv-accent);font-weight:600">· NUEVO</span>' : ''}
            </div>
          </div>
          <a href="https://mail.google.com/mail/u/1/?view=cm&fs=1&to=${encodeURIComponent(l.email)}&su=${encodeURIComponent('Tu plan personalizado — K-ONE')}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,var(--jv-accent-2),var(--jv-accent));box-shadow:0 3px 10px rgba(255,95,46,.28);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:transform .15s" onmouseenter="this.style.transform='scale(1.1)'" onmouseleave="this.style.transform='none'">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--jv-text)" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          </a>
        </div>`;
      }).join('');
  }
  _actualizarBarraSeleccionLeads();
}

// Renderiza solo la tabla (filtros + orden sin volver a la API)
function renderTablaAdmin() {
  if (!_adminDatos) return;
  const { clientes } = _adminDatos;

  // Filtro por tipo
  let lista = clientes.filter(c => {
    switch (_adminFiltro.tipo) {
      case 'alertas': return c.alerta === 'red' || c.alerta === 'orange';
      case 'activos': return c.estado === 'active';
      case 'prueba':  return c.estado === 'trialing';
      case 'premium': return c.isBeta;
      case 'sinpago': return !['active','trialing','past_due','canceled','unpaid','premium'].includes(c.estado);
      case 'nuevos':  return c.esNuevo;
      case 'bajas':   return ['canceled','unpaid'].includes(c.estado);
      // Filtros del Centro de acción diaria
      case 'revisar':      return _accRevisarPlan(c);
      case 'past_due':     return _accPagoFallido(c);
      case 'cancela':      return _accCancela(c);
      case 'premiumcaduca':return _accPremiumCaduca(c);
      case 'inactivos':    return _accInactivo(c);
      case 'sinentrenar':  return _accSinEntrenar(c);
      case 'renueva7':     return _accRenueva7(c);
      default: return true;
    }
  });

  // Filtro por texto
  if (_adminFiltro.texto) {
    const q = _adminFiltro.texto.toLowerCase();
    lista = lista.filter(c =>
      (c.nombre || '').toLowerCase().includes(q) ||
      (c.email  || '').toLowerCase().includes(q)
    );
  }

  // Los PREMIUM (acceso concedido a mano) no salen en la tabla general: no
  // son clientes de pago y ensuciaban la vista de todos los días -- aparecían
  // arriba como "SIN PAGO" mezclados con los que sí pagan. Siguen estando a
  // un clic: salen con el filtro "Premium", con el de precio "premium", y
  // buscando por nombre o email, que es como se busca a alguien concreto.
  const _buscando = !!_adminFiltro.texto;
  const _pidePremium = _adminFiltro.tipo === 'premium'
    || document.getElementById('adminFiltroPrecio')?.value === 'premium';
  let _premiumOcultos = 0;
  if (_adminFiltro.tipo === 'todos' && !_buscando && !_pidePremium) {
    const antes = lista.length;
    lista = lista.filter(c => !c.isBeta);
    _premiumOcultos = antes - lista.length;
  }

  // Filtros de estudio de mercado
  const fPlan = document.getElementById('adminFiltroPlan')?.value;
  if (fPlan) {
    lista = lista.filter(c => fPlan === 'completo'
      ? (c.tipoPlan || '').toLowerCase().includes('completo')
      : (c.tipoPlan || '').toLowerCase().includes('nutrici'));
  }
  const fDeporte = document.getElementById('adminFiltroDeporte')?.value;
  if (fDeporte) lista = lista.filter(c => (c.deporte || '').includes(fDeporte));
  const fObjetivo = document.getElementById('adminFiltroObjetivo')?.value;
  if (fObjetivo) lista = lista.filter(c => (c.objetivo || '').includes(fObjetivo));
  const fEntrenos = document.getElementById('adminFiltroEntrenos')?.value;
  if (fEntrenos) {
    if (fEntrenos === '0') lista = lista.filter(c => (c.entrenosTotal || 0) === 0);
    else if (fEntrenos === '1-5') lista = lista.filter(c => c.entrenosTotal >= 1 && c.entrenosTotal <= 5);
    else if (fEntrenos === '6+') lista = lista.filter(c => c.entrenosTotal >= 6);
  }
  const fPrecio = document.getElementById('adminFiltroPrecio')?.value;
  if (fPrecio) {
    if (fPrecio === 'premium') lista = lista.filter(c => c.isBeta);
    else if (fPrecio === 'sinpago') lista = lista.filter(c => (c.planPrecio || '—') === '—');
    else lista = lista.filter(c => (c.planPrecio || '').includes(fPrecio));
  }

  // Orden
  lista = [...lista].sort((a, b) => {
    let va = a[_adminSort.col], vb = b[_adminSort.col];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va == null) va = '';
    if (vb == null) vb = '';
    return va < vb ? -_adminSort.dir : va > vb ? _adminSort.dir : 0;
  });

  const filtroEl = document.getElementById('adminTotalFiltro');
  if (filtroEl) filtroEl.textContent = lista.length;

  // Que se vea que están ocultos y no que han desaparecido: sin esta línea,
  // buscar a un premium en la tabla y no encontrarlo parece un fallo.
  const avisoEl = document.getElementById('adminAvisoPremium');
  // Emails invitados que todavía no han creado su cuenta: no son perfiles,
  // así que no salen en la tabla. Sin esto no había forma de ver a quién se
  // había invitado.
  const _pendientes = (_adminDatos?.premiumReconciliado?.pendientes) || [];
  if (avisoEl) {
    if (_pidePremium && _pendientes.length) {
      avisoEl.innerHTML = `Invitados que aún no han entrado (tendrán el premium al entrar, sin pagar): `
        + _pendientes.map(p => `<strong style="color:var(--jv-warn);font-weight:600">${_esc(p.email)}</strong>`).join(', ');
      avisoEl.style.display = '';
    } else if (_premiumOcultos > 0) {
      avisoEl.innerHTML = `${_premiumOcultos} cliente${_premiumOcultos === 1 ? '' : 's'} premium sin mostrar · `
        + `<button onclick="filtrarAdminTipo('premium')" style="background:none;border:none;padding:0;color: var(--brasa-txt);font:inherit;cursor:pointer;text-decoration:underline">ver</button>`;
      avisoEl.style.display = '';
    } else {
      avisoEl.style.display = 'none';
    }
  }

  const tabla = document.getElementById('adminTabla');
  if (!tabla) return;

  const sortIcon = (col) => _adminSort.col === col
    ? (_adminSort.dir === 1 ? ' ↑' : ' ↓') : '';

  const TH_BASE = 'text-align:left;padding:12px 14px;font-family:var(--jv-ui);font-size:10.5px;font-weight:700;color:var(--jv-faint);text-transform:uppercase;letter-spacing:.07em;border-bottom:1px solid var(--jv-line);white-space:nowrap';
  const thS = (t, col) => {
    const act = _adminSort.col === col ? ';color:var(--jv-accent-2)' : '';
    return `<th style="${TH_BASE};cursor:pointer;user-select:none${act}" onclick="ordenarAdminCol('${col}')">${t}${sortIcon(col)}</th>`;
  };
  const thN = (t) => `<th style="${TH_BASE}">${t}</th>`;
  const td  = (c) => `<td style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.05);white-space:nowrap">${c}</td>`;

  // El punto de alerta lleva halo del mismo color: en una tabla larga, un
  // punto plano de 9px se pierde; con el halo la fila "canta" al escanear.
  const alertaDot = (c) => {
    const cols = { red:'255,94,94', orange:'255,149,86', yellow:'255,197,61', green:'61,220,151' };
    const rgb = cols[c.alerta];
    if (!rgb) return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.09)"></span>`;
    return `<span title="${_esc(c.alertaRazon)}" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:rgb(${rgb});box-shadow:0 0 0 3px rgba(${rgb},.18);cursor:help"></span>`;
  };

  const cabecera = `<thead><tr>
    ${thN('')}
    ${thS('Cliente','nombre')}
    ${thN('Email')}
    ${thS('Alta','alta')}
    ${thN('Estado')}
    ${thN('Plan')}
    ${thN('Objetivo')}
    ${thN('Deporte')}
    ${thS('Entrenos','entrenosTotal')}
    ${thS('Semana','semanaActual')}
    ${thS('Renueva','renovacion')}
    ${thS('Última conexión','ultimaConexion')}
    ${thN('Lesión')}
    ${thN('')}
  </tr></thead>`;

  const filas = lista.length === 0
    ? `<tr><td colspan="14" style="text-align:center;padding:40px;color:var(--jv-faint);font-size:13.5px;font-weight:500">No hay clientes que coincidan con el filtro.</td></tr>`
    : lista.map((c, idx) => {
        const rowBg = c.isBeta ? 'background:rgba(255,197,61,.045)' : c.alerta==='red' ? 'background:rgba(255,94,94,.05)' : c.alerta==='orange' ? 'background:rgba(255,149,86,.04)' : '';
        const badgeNuevo = c.esNuevo ? '<span class="jv-chip" style="background:rgba(255,95,46,.14);color:var(--jv-accent-2);border:1px solid rgba(255,95,46,.3);margin-left:7px">Nuevo</span>' : '';
        const badgePremium = c.isBeta ? '<span class="jv-chip" style="background:rgba(255,197,61,.13);color:var(--jv-warn);border:1px solid rgba(255,197,61,.3);margin-left:7px">★ Premium</span>' : '';
        // Hallazgo del agente de auditoría diario: alimento prohibido colado
        // en el plan ya guardado. Va primero en la fila (antes que "Nuevo"
        // o "Premium") porque es lo más urgente de revisar.
        const badgeAuditoria = (c.auditoriaHallazgos && c.auditoriaHallazgos.length)
          // Icono SVG de línea, no emoji (regla de diseño del proyecto: aquí
          // había un ⚠ literal, que en la mayoría de fuentes se pinta como
          // un emoji amarillo, justo lo que la regla evita).
          ? '<span class="jv-chip" style="background:rgba(255,94,94,.16);color:var(--jv-bad);border:1px solid rgba(255,94,94,.35);margin-left:7px" title="Alimento prohibido detectado en su plan"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px" aria-hidden="true"><path d="M10.3 3.9 2 18a1.5 1.5 0 0 0 1.3 2.2h17.4A1.5 1.5 0 0 0 22 18L13.7 3.9a1.5 1.5 0 0 0-2.6 0z"/><line x1="12" y1="9.5" x2="12" y2="13.5"/><circle cx="12" cy="16.5" r=".6" fill="currentColor"/></svg> Revisar</span>' : '';
        const isBaja = ['canceled','unpaid'].includes(c.estado);
        const realIdx = clientes.indexOf(c);
        return `<tr style="${rowBg};cursor:pointer;transition:background .15s" onmouseenter="this.style.background='rgba(255,255,255,.04)'" onmouseleave="this.style.background='${rowBg.replace('background:','') || 'transparent'}'" onclick="verDetalleCliente(${realIdx})">
          ${td(alertaDot(c))}
          ${td('<span style="font-weight:700;color:var(--jv-text);font-size:13.5px;letter-spacing:-.01em' + (isBaja ? ';opacity:.5' : '') + '">' + _esc(c.nombre) + '</span>' + badgeAuditoria + badgePremium + badgeNuevo + (isBaja ? '<span class="jv-chip" style="background:rgba(255,94,94,.13);color:var(--jv-bad);border:1px solid rgba(255,94,94,.28);margin-left:7px">Baja</span>' : ''))}
          ${td('<span style="color:var(--jv-faint);font-size:12.5px">' + _esc(c.email) + '</span>')}
          ${td('<span style="color:var(--jv-dim);font-size:12.5px;font-variant-numeric:tabular-nums">' + _fmtFecha(c.alta) + '</span>')}
          ${td(_estadoLegible(c))}
          ${td('<span style="color:var(--jv-dim);font-size:12.5px">' + _esc(c.tipoPlan) + '</span>' + (c.planPrecio && c.planPrecio !== '—' ? '<br><span style="font-size:11.5px;font-weight:600;color:' + (c.enOferta || c.estado === 'premium' ? 'var(--jv-warn)' : 'var(--jv-ok)') + '">' + _esc(c.planPrecio) + '</span>' : ''))}
          ${td('<span style="color:var(--jv-dim);font-size:12.5px">' + _esc(c.objetivo) + '</span>')}
          ${td('<span style="color:var(--jv-dim);font-size:12.5px">' + _esc(c.deporte) + '</span>')}
          ${td(c.entrenosTotal > 0
            ? '<span style="color:var(--jv-ok);font-weight:700;font-variant-numeric:tabular-nums">' + c.entrenosTotal + '</span>'
            : '<span style="color:var(--jv-faint);font-variant-numeric:tabular-nums">0</span>')}
          ${td('<span style="color:var(--jv-dim);font-size:12.5px;font-variant-numeric:tabular-nums">Sem. ' + (c.semanaActual || 1) + '</span>')}
          ${td(c.estado === 'premium'
            ? '<span style="color:var(--jv-warn);font-size:12.5px;font-variant-numeric:tabular-nums" title="Premium hasta esta fecha. No se le cobra nada.">Hasta ' + _fmtFecha(c.renovacion) + '</span>'
            : '<span style="color:var(--jv-dim);font-size:12.5px;font-variant-numeric:tabular-nums">' + _fmtFecha(c.renovacion) + '</span>')}
          ${td('<span style="color:' + _colorConexion(c.ultimaConexion) + ';font-size:12.5px;font-weight:500" title="' + (c.ultimaConexion ? _fmtFecha(c.ultimaConexion) : 'Sin registro') + '">' + _fmtRelativo(c.ultimaConexion) + '</span>')}
          ${td(c.lesion
            ? '<span class="jv-chip" style="background:rgba(255,149,86,.12);color:#FF9556;border:1px solid rgba(255,149,86,.26)">Lesión</span>'
            : '<span style="color:var(--jv-faint)">—</span>')}
          ${td('<a href="mailto:' + _esc(c.email) + '" onclick="event.stopPropagation()" title="Enviar email" style="color:var(--jv-faint);text-decoration:none;transition:color .15s;display:inline-block" onmouseenter="this.style.color=\'var(--jv-accent-2)\'" onmouseleave="this.style.color=\'var(--jv-faint)\'"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></a>')}
        </tr>`;
      }).join('');

  tabla.innerHTML = cabecera + '<tbody>' + filas + '</tbody>';
}

function buscarAdmin(v) {
  _adminFiltro.texto = v || '';
  renderTablaAdmin();
}

function filtrarAdminTipo(tipo) {
  _adminFiltro.tipo = tipo;
  _activarFiltroBtn(tipo);
  renderTablaAdmin();
}

function _activarFiltroBtn(tipo) {
  document.querySelectorAll('.jarvis-filtro').forEach(b => {
    b.classList.toggle('jarvis-filtro-active', b.textContent.trim().toLowerCase().includes(
      tipo === 'todos' ? 'todos' :
      tipo === 'alertas' ? 'alertas' :
      tipo === 'activos' ? 'pagando' :
      tipo === 'prueba' ? 'mes gratis' :
      tipo === 'revisar' ? 'revisar plan' :
      tipo === 'premium' ? 'premium' :
      tipo === 'sinpago' ? 'sin pago' :
      tipo === 'nuevos' ? 'nuevos' :
      tipo === 'bajas' ? 'bajas' : 'todos'
    ));
  });
}

function ordenarAdminCol(col) {
  if (_adminSort.col === col) _adminSort.dir *= -1;
  else { _adminSort.col = col; _adminSort.dir = 1; }
  renderTablaAdmin();
}

function exportarAdminCSV() {
  if (!_adminDatos) return;
  const cols = ['Nombre','Email','Edad','Alta','Estado','Plan','Objetivo','Deporte','Renovación dieta','Entrenos','Semana','Renovación','Última conexión','Lesión','Alerta'];
  const fila = (c) => [
    c.nombre, c.email, c.edad || '',
    c.alta ? new Date(c.alta).toLocaleDateString('es-ES') : '',
    c.enOferta ? 'Oferta 1,99€' : c.estado,
    c.tipoPlan, c.objetivo, c.deporte,
    { semanal: 'Semanal', mensual: 'Mensual', fija: 'Fija' }[c.rotacionMenu] || 'Mensual',
    c.entrenosTotal, c.semanaActual,
    c.renovacion ? new Date(c.renovacion).toLocaleDateString('es-ES') : '',
    c.ultimaConexion ? new Date(c.ultimaConexion).toLocaleString('es-ES') : 'Nunca',
    c.lesion ? 'Sí' : 'No',
    c.alertaRazon || ''
  ].map(_csvSafe).join(',');

  const csv = [cols.join(','), ..._adminDatos.clientes.map(fila)].join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'jarvis-clientes-' + new Date().toISOString().slice(0,10) + '.csv';
  a.click(); URL.revokeObjectURL(url);
}

// Etiquetas legibles para userData._cuenta.motivoBaja -- compartidas entre
// la ficha del cliente (verDetalleCliente) y el panel agregado del
// Dashboard (actualizarPanelAdmin), para que no diverjan con el tiempo.
const MOTIVOS_LABEL = {
  'Precio': 'Es caro para mí', 'Falta de uso': 'No lo estaba usando',
  'Entrenos': 'Los entrenos no le encajaban', 'Dieta': 'La dieta no le encajaba',
  'Falta variedad': 'Se le hacía repetitivo', 'Fallos': 'Algo no funcionaba bien',
  'Objetivo cumplido': 'Ya consiguió su objetivo', 'Otro': 'Otro motivo (ver Buzón)',
  'solo_texto': 'Solo escribió texto libre (ver Buzón)', 'sin_respuesta': 'Prefirió no decirlo'
};

// Modal de detalle de cliente
function verDetalleCliente(idx) {
  if (!_adminDatos) return;
  const c = _adminDatos.clientes[idx];
  if (!c) return;
  document.getElementById('jcNombre').textContent = c.nombre || '—';
  document.getElementById('jcEmail').textContent  = c.email  || '—';
  const mailto = document.getElementById('jcMailto');
  if (mailto) mailto.href = 'mailto:' + (c.email || '');

  // "val" puede ser texto libre que escribió el cliente en el cuestionario
  // (lesionDetalle, alergiaOtra, medicación...) y esto se pinta con
  // innerHTML en el panel de admin: sin escapar, un cliente podía meter
  // HTML/JS en esos campos y ejecutarlo en la sesión del ADMIN en cuanto
  // abriera su ficha — más grave que un XSS contra su propia cuenta, aquí
  // compromete la cuenta que puede dar premium o borrar clientes.
  const row = (label, val, color) => `
    <div class="jc-row">
      <div><div class="jc-label">${_esc(label)}</div><div class="jc-val" style="${color?'color:'+color:''}">${val ? _esc(String(val)) : '—'}</div></div>
    </div>`;
  // Varios campos del cuestionario vienen del helper getRadio() del
  // formulario, que devuelve el texto literal "No especificado" cuando el
  // cliente no marcó nada -- hay que tratarlo como vacío, no como un valor real.
  const _valido = (v) => !!v && v !== 'No especificado' && v !== 'No';
  // Divisor de sección con el mismo estilo que ya usaba "Nota privada".
  const seccion = (titulo) => `<div style="margin-top:16px;padding-top:15px;border-top:1px solid var(--jv-line)"><div class="jc-label" style="margin-bottom:10px">${_esc(titulo)}</div></div>`;

  const estadoColor = (c.enOferta || c.estado === 'premium') ? 'var(--jv-warn)' : c.estado==='past_due' ? 'var(--jv-bad)' :
    ['active','trialing'].includes(c.estado) ? 'var(--jv-ok)' : 'var(--jv-dim)';
  // BUG REAL (17 sept 2026): sin la rama final del propio 'none', c.estado
  // || 'Sin pago' colaba el valor interno de Stripe TAL CUAL en pantalla
  // ('none', 'unpaid', 'incomplete'...) en vez de "Sin pago" -- 'none' es
  // un string, no vacío, así que el || nunca llegaba a activarse para él.
  // Y un cliente premium (is_beta) sin ninguna suscripción de Stripe detrás
  // leía "Sin pago", que suena a que debe algo cuando no debe nada.
  const estadoTexto = c.estado === 'premium' ? 'Premium · no paga' :
    c.enOferta ? 'Oferta 1,99€' : c.cancelaAlFinal ? 'Cancela al final' :
    c.estado === 'past_due' ? 'Pago fallido' :
    c.estado === 'active' ? 'Pagando' : c.estado === 'trialing' ? 'Mes gratis (aún no paga)' :
    c.estado === 'canceled' ? 'Cancelado' :
    (c.estado === 'none' || !c.estado) ? (c.isBeta ? 'Premium (sin Stripe)' : 'Sin pago') : c.estado;

  // La salud del cliente abre la ficha con la cifra en grande: es el
  // resumen de "¿este cliente está bien o se me va?" en un solo golpe.
  const hs = _healthScore(c);

  // Días entrenados esta semana (Lun-Dom), calculado en el servidor
  // (admin-clientes.js) a partir de historialEntrenos -- aquí solo se pinta.
  const _diasSemanaNombres = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const _diasSemanaHTML = (() => {
    const dias = c.diasEntrenoSemana || [false, false, false, false, false, false, false];
    const letras = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    const hoyIdx = (new Date().getDay() + 6) % 7;
    return dias.map((hecho, i) => `
      <div style="display:flex;flex-direction:column;align-items:center;gap:5px">
        <span aria-hidden="true" style="font-size:10px;color:var(--jv-faint);font-weight:700">${letras[i]}</span>
        <div role="img" aria-label="${_diasSemanaNombres[i]}: ${hecho ? 'entrenado' : 'sin entrenar'}" style="width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${hecho ? 'linear-gradient(135deg,var(--jv-accent-2),var(--jv-accent))' : 'var(--jv-glass)'};border:1px solid ${hecho ? 'transparent' : (i === hoyIdx ? 'rgba(255,95,46,.5)' : 'var(--jv-line)')}">
          ${hecho ? '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#fff" stroke-width="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
        </div>
      </div>`).join('');
  })();

  // Consistencia de las últimas 4 semanas (más antigua a la izquierda, esta
  // semana a la derecha): "esta semana" sola no dice si el cliente va a más
  // o a menos, solo si esta semana concreta entrenó. Comparando las 2
  // semanas más recientes contra las 2 más antiguas se saca una tendencia.
  const _consistenciaHTML = (() => {
    const semanas = c.entrenosUltimasSemanas || [0, 0, 0, 0];
    if (!semanas.some(n => n > 0)) return '';
    const etiquetas = ['Hace 3 sem.', 'Hace 2 sem.', 'Hace 1 sem.', 'Esta semana'];
    const max = Math.max(7, ...semanas);
    const barras = semanas.map((n, i) => `
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex:1">
        <span style="font-size:11px;color:var(--jv-text);font-weight:700;font-family:var(--jv-display)">${n}</span>
        <div style="width:100%;max-width:34px;height:44px;display:flex;align-items:flex-end;background:rgba(255,255,255,.05);border-radius:6px;overflow:hidden">
          <div style="width:100%;height:${Math.round((n / max) * 100)}%;background:${i === 3 ? 'linear-gradient(180deg,var(--jv-accent-2),var(--jv-accent))' : 'var(--jv-glass-hi)'};transition:height .4s"></div>
        </div>
        <span style="font-size:9px;color:var(--jv-faint);font-weight:600;text-align:center">${etiquetas[i]}</span>
      </div>`).join('');
    // La semana actual casi nunca está completa (normalmente se mira a
    // media semana), así que compararla en bruto contra semanas ya
    // cerradas sesga la tendencia hacia "Bajando" casi siempre. Se
    // proyecta a equivalente-semana-completa antes de comparar, y un
    // margen de ruido evita que una diferencia mínima cambie la etiqueta.
    const diasTranscurridos = Math.min(7, Math.max(1, c.diasTranscurridosSemanaActual || 7));
    const semana4Proyectada = semanas[3] * 7 / diasTranscurridos;
    const antes = semanas[0] + semanas[1], despues = semanas[2] + semana4Proyectada;
    const margenRuido = Math.max(1, antes * 0.15);
    const tendencia = despues > antes + margenRuido
      ? { texto: 'Mejorando', color: 'var(--jv-ok)', flecha: '↑' }
      : despues < antes - margenRuido
      ? { texto: 'Bajando', color: 'var(--jv-bad)', flecha: '↓' }
      : { texto: 'Estable', color: 'var(--jv-dim)', flecha: '→' };
    return `
    <div class="jc-row" style="flex-direction:column;align-items:stretch;gap:0">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div class="jc-label" style="margin-bottom:0">Consistencia (últimas 4 semanas)</div>
        <span style="font-size:11px;font-weight:800;color:${tendencia.color}">${tendencia.flecha} ${tendencia.texto}</span>
      </div>
      <div style="display:flex;gap:8px">${barras}</div>
    </div>`;
  })();

  // Progreso de peso corporal: primera y última entrada válida de
  // historialPeso (se registra en cada check-in semanal real, no un valor
  // suelto). El color depende del objetivo: perder grasa y bajar es verde,
  // ganar músculo y subir es verde; "sentirme mejor" no juzga dirección.
  // El servidor manda como mucho las últimas 26 entradas (admin-clientes.js)
  // para no viajar el historial completo -- para un cliente veterano eso ya
  // NO es "desde el principio", así que la ficha tiene que dejarlo claro
  // (fecha del primer registro mostrado) en vez de dar a entender que
  // "ini" es el peso con el que empezó de verdad.
  const _progresoPeso = (() => {
    const hist = (c.historialPeso || []).filter(x => x && Number(x.peso) > 0)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    if (hist.length < 2) return null;
    const ini = Number(hist[0].peso), fin = Number(hist[hist.length - 1].peso);
    const delta = Math.round((fin - ini) * 10) / 10;
    const obj = c.objetivo || '';
    const buena = obj.includes('Perder') ? delta < 0 : obj.includes('músculo') ? delta > 0 : null;
    return { ini, fin, delta, desde: hist[0].fecha, truncado: (c.historialPeso || []).length >= 26, color: buena === true ? 'var(--jv-ok)' : buena === false ? 'var(--jv-warn)' : 'var(--jv-dim)' };
  })();

  // Ejercicios con progresión registrada: los 5 actualizados más
  // recientemente, ordenados por fecha del último registro. Se exige al
  // menos 2 puntos -- con 1 solo no hay progresión real que enseñar, y
  // si se cuela ocupa un hueco de los 5 que sí tienen algo que contar.
  const _ejerciciosProgreso = Object.values(c.pesosEjercicios || {})
    .map(e => {
      const h = (e.historial || []).filter(x => x && Number(x.peso) > 0).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
      if (h.length < 2) return null;
      return { nombre: e.nombre, ini: Number(h[0].peso), fin: Number(h[h.length - 1].peso), ultima: h[h.length - 1].fecha, truncado: (e.historial || []).length >= 8 };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.ultima) - new Date(a.ultima))
    .slice(0, 5);

  document.getElementById('jcBody').innerHTML = `
    ${(() => {
      // Aviso del agente de auditoría diario (api/notify.js + lib/
      // normalizador-alimentos.js): alimentos de su lista "no como"/alergia
      // que se colaron en el plan YA guardado -- el mismo tipo de fallo que
      // se encontró a mano con Esther y Pablo, ahora revisado cada día para
      // todos los clientes. Va lo primero de la ficha, antes incluso de
      // "Salud del cliente": es un aviso de seguridad alimentaria, más
      // urgente que cualquier métrica de retención.
      const h = c.auditoriaHallazgos;
      if (!h || !h.length) return '';
      // Cada hallazgo dice DÓNDE está (plato y campo) y enseña el trozo de
      // texto, para poder juzgarlo sin abrir el plan del cliente. El formato
      // viejo (solo token/coincidencia) se sigue pintando por si queda alguna
      // fila de antes.
      const CAMPO = { nombre: 'nombre del plato', ingredientes: 'ingredientes', pasos: 'preparación' };
      const lista = h.map(x => x.plato
        ? `<li style="margin-bottom:7px"><strong>${_esc(x.coincidencia)}</strong> en «${_esc(x.plato)}» <span style="color:var(--jv-faint)">(${_esc(CAMPO[x.campo] || x.campo)} · ${_esc(x.motivo)}${x.veces > 1 ? ' · aparece ' + x.veces + ' veces' : ''})</span>${x.fragmento ? `<div style="font-size:11px;color:var(--jv-faint);margin-top:2px;line-height:1.5">${_esc(x.fragmento)}</div>` : ''}</li>`
        : `<li><strong>${_esc(x.coincidencia)}</strong> <span style="color:var(--jv-faint)">(por "${_esc(x.token)}")</span></li>`).join('');
      return `<div style="background:rgba(255,94,94,.10);border:1px solid rgba(255,94,94,.35);border-radius:14px;padding:15px 17px;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--jv-bad)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span class="jc-label" style="margin-bottom:0;color:var(--jv-bad)">Alimentos prohibidos detectados en su plan</span>
        </div>
        <ul style="margin:0 0 10px;padding-left:18px;font-size:12.5px;color:var(--jv-text);line-height:1.7">${lista}</ul>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div style="font-size:11.5px;color:var(--jv-faint)">Detectado el ${_fmtFecha(c.auditoriaFecha)}. Usa "Regenerar plan" (más abajo) para corregirlo.</div>
          <button class="jv-btn-flat jv-btn-flat-bad" onclick="marcarRevisionHecha('${c.id}', this)" title="Ciérralo si ya has comprobado el plan a mano, o si es un falso aviso. Si el fallo sigue ahí de verdad, el robot lo volverá a detectar solo.">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            Marcar revisión hecha
          </button>
        </div>
      </div>`;
    })()}
    <div style="background:linear-gradient(135deg,rgba(${hs.rgb},.10),var(--jv-glass));border:1px solid rgba(${hs.rgb},.26);border-radius:14px;padding:15px 17px;margin-bottom:12px">
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:11px">
        <span class="jc-label" style="margin-bottom:0">Salud del cliente</span>
        <span style="font-family:var(--jv-display);font-size:13px;font-weight:700;color:${hs.color};letter-spacing:-.01em">${hs.label}</span>
      </div>
      <div style="display:flex;align-items:baseline;gap:5px;margin-bottom:11px">
        <span style="font-family:var(--jv-display);font-size:32px;font-weight:800;color:${hs.color};line-height:1;letter-spacing:-.04em;font-variant-numeric:tabular-nums">${hs.score}</span>
        <span style="font-size:13px;color:var(--jv-faint);font-weight:600">/100</span>
      </div>
      <div style="background:rgba(255,255,255,.07);border-radius:999px;height:7px;overflow:hidden">
        <div style="height:100%;width:${hs.score}%;background:linear-gradient(90deg,rgba(${hs.rgb},.55),rgb(${hs.rgb}));border-radius:999px;transition:width .55s cubic-bezier(.2,.7,.3,1)"></div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      ${row('Estado', estadoTexto, estadoColor)}
      ${row('Plan', c.tipoPlan + (c.planPrecio && c.planPrecio !== '—' ? ' · ' + c.planPrecio : ''))}
    </div>
    ${c.origen && c.origen.fuente ? `<div style="display:grid;grid-template-columns:1fr;gap:10px">${row('Cómo llegó', c.origenTexto + (c.origen.fecha ? ' · ' + c.origen.fecha.split('-').reverse().join('/') : ''), 'var(--jv-info)')}</div>` : ''}
    ${(() => {
      // Solo aparece si ha cancelado o si ya contestó al banner "¿Nos dices
      // por qué lo dejas?" (index.html, sección Hoy). Las tres situaciones
      // posibles: no ha vuelto a entrar desde que canceló (motivoBaja aún
      // null), prefirió no decirlo (guardado como 'sin_respuesta'), o marcó
      // un motivo concreto -- el texto libre que haya escrito, si lo hizo,
      // no viaja aquí (no se guarda en el perfil): está completo en su
      // mensaje del Buzón, con el mismo sello de tiempo.
      if (!c.cancelaAlFinal && !c.motivoBaja) return '';
      const texto = !c.motivoBaja ? 'Aún no ha vuelto a entrar desde que canceló'
        : (MOTIVOS_LABEL[c.motivoBaja] || c.motivoBaja);
      const color = (c.motivoBaja && c.motivoBaja !== 'sin_respuesta') ? 'var(--jv-warn)' : 'var(--jv-faint)';
      return `<div style="display:grid;grid-template-columns:1fr;gap:10px">
        ${row('Motivo de baja', texto + (c.motivoBajaFecha ? ' · ' + _fmtFecha(c.motivoBajaFecha) : ''), color)}
      </div>`;
    })()}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      ${row('Alta', _fmtFecha(c.alta))}
      ${(() => {
        // BUG REAL (17 sept 2026, reportado por el usuario sobre un cliente
        // real): esta fila cambiaba la ETIQUETA a "Expira premium" si el
        // cliente es beta, pero seguía mostrando `c.renovacion`. Ese campo
        // (admin-clientes.js) es `s?.current_period_end || p.beta_expires`
        // -- prioriza la suscripción de Stripe. Un cliente con premium
        // concedido (1 año) que ADEMÁS tiene una suscripción de Stripe
        // detrás (p. ej. el mes de prueba gratis sin cancelar) enseñaba la
        // fecha de cobro de Stripe bajo la etiqueta de premium: parecía
        // que el premium caducaba en 1 mes cuando en realidad caduca en 1
        // año, y el dato real (Stripe SÍ va a intentar cobrarle) se perdía
        // -- se veía como si "tuviera que pagar" sin más contexto.
        if (c.isBeta) return row('Expira premium', _fmtFecha(c.betaExpires),
          c.betaExpires && new Date(c.betaExpires) < new Date() ? 'var(--jv-bad)' : 'var(--jv-warn)');
        return row('Renueva', _fmtFecha(c.renovacion));
      })()}
    </div>
    ${c.isBeta && ['active', 'trialing', 'past_due', 'unpaid'].includes(c.estadoStripe) ? `<div style="display:grid;grid-template-columns:1fr;gap:10px">
      ${row('Aviso: le queda una suscripción de Stripe que puede cobrarle' + (c.renovacionStripe ? ' el' : ''), c.renovacionStripe ? _fmtFecha(c.renovacionStripe) : 'pendiente', 'var(--jv-bad)')}
      <button style="padding:11px;font-size:12.5px;font-weight:700;font-family:var(--jv-ui);border:none;border-radius:12px;cursor:pointer;background:rgba(255,94,94,.16);color:var(--jv-bad);box-shadow:inset 0 0 0 1px rgba(255,94,94,.3)" onclick="detenerStripeCliente('${c.id}', this)">Cancelar esa suscripción de Stripe</button>
    </div>` : ''}
    <div style="display:grid;grid-template-columns:1fr;gap:10px">
      ${row('Última conexión', _fmtRelativo(c.ultimaConexion) + (c.ultimaConexion ? ' · ' + _fmtFecha(c.ultimaConexion) : ''), _colorConexion(c.ultimaConexion))}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
      ${row('Objetivo', c.objetivo)}
      ${row('Deporte', c.deporte)}
      ${row('Edad', c.edad ? c.edad + ' años' : '—')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      ${row('Altura', c.altura ? c.altura + ' cm' : null)}
      ${row('Nivel', _valido(c.nivel) ? c.nivel : null)}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      ${row('Días de entreno', _valido(c.diasEntreno) ? c.diasEntreno : null)}
      ${row('Dónde entrena', _valido(c.lugar) ? c.lugar : null)}
    </div>
    <div style="display:grid;grid-template-columns:1fr;gap:10px">
      ${row('Renovación de dieta', { semanal: 'Semanal', mensual: 'Mensual', fija: 'Fija' }[c.rotacionMenu] || 'Mensual')}
    </div>
    ${_valido(c.evento) ? row('Evento objetivo', c.evento + (c.eventoFecha ? ' · ' + c.eventoFecha : '')) : ''}
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
      ${row('Semana', c.semanaActual || 1)}
      ${row('Entrenos totales', c.entrenosTotal || 0, c.entrenosTotal > 0 ? 'var(--jv-ok)' : null)}
      ${row('Peso actual', c.peso ? String(c.peso).replace('.', ',') + ' kg' : '—')}
    </div>
    <div class="jc-row" style="flex-direction:column;align-items:stretch;gap:0">
      <div class="jc-label" style="margin-bottom:10px">Esta semana</div>
      <div style="display:flex;justify-content:space-between;gap:4px">${_diasSemanaHTML}</div>
    </div>
    ${_consistenciaHTML}
    ${_progresoPeso ? `
    <div class="jc-row">
      <div>
        <div class="jc-label">Progreso de peso${_progresoPeso.truncado ? ` <span style="font-weight:500;color:var(--jv-faint)">(desde ${_fmtFecha(_progresoPeso.desde)})</span>` : ''}</div>
        <div class="jc-val">${_progresoPeso.ini} kg → ${_progresoPeso.fin} kg <span style="color:${_progresoPeso.color};font-weight:800">(${_progresoPeso.delta > 0 ? '+' : ''}${_progresoPeso.delta} kg)</span></div>
      </div>
    </div>` : ''}
    ${_ejerciciosProgreso.length ? `
    <div>
      <div class="jc-label" style="margin-bottom:8px">Ejercicios con progresión ${_ejerciciosProgreso.some(e => e.truncado) ? '<span style="font-weight:500;color:var(--jv-faint)">(últimos registros)</span>' : ''}</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${_ejerciciosProgreso.map(e => `
        <div style="display:flex;align-items:center;justify-content:space-between;background:var(--jv-glass);border:1px solid var(--jv-line);border-radius:10px;padding:8px 12px">
          <span style="font-size:12.5px;color:var(--jv-text);font-weight:600">${_esc(e.nombre)}</span>
          <span style="font-size:12.5px;font-family:var(--jv-display);font-weight:700;color:${e.fin > e.ini ? 'var(--jv-ok)' : e.fin < e.ini ? 'var(--jv-bad)' : 'var(--jv-faint)'}">${e.ini} → ${e.fin} kg</span>
        </div>`).join('')}
      </div>
    </div>` : ''}
    ${c.lesion ? row('Lesión', c.lesionDetalle || 'Sí', '#FF9556') : ''}
    ${_valido(c.enfermedad) ? row('Enfermedad diagnosticada', c.enfermedadOtra || c.enfermedad, '#FF9556') : ''}
    ${c.alergia && c.alergia !== 'No' ? row('Alergia', c.alergiaOtra || c.alergia) : ''}
    ${c.medicacion && c.medicacion !== 'No' ? row('Medicación', c.medicacion) : ''}
    ${_valido(c.operacion) ? row('Operación reciente', c.operacion, '#FF9556') : ''}
    ${(_valido(c.dieta) || _valido(c.comidas)) ? `
    ${seccion('Nutrición')}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      ${row('Tipo de dieta', _valido(c.dieta) ? c.dieta : null)}
      ${row('Comidas al día', _valido(c.comidas) ? c.comidas : null)}
    </div>` : ''}
    ${_valido(c.noComida) ? row('Alimentos que evita', c.noComida) : ''}
    ${(_valido(c.jornada) || _valido(c.estres) || _valido(c.sueno)) ? `
    ${seccion('Estilo de vida')}
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
      ${row('Jornada', _valido(c.jornada) ? c.jornada : null)}
      ${row('Estrés', _valido(c.estres) ? c.estres : null)}
      ${row('Sueño', _valido(c.sueno) ? c.sueno : null)}
    </div>` : ''}
    ${c.alertaRazon ? row('Alerta activa', c.alertaRazon,
      c.alerta==='red' ? 'var(--jv-bad)' : c.alerta==='orange' ? '#FF9556' : 'var(--jv-warn)') : ''}
    ${row('Onboarding completado', c.onboarding ? '✓ Sí' : '✗ No', c.onboarding ? 'var(--jv-ok)' : 'var(--jv-faint)')}
    <div style="margin-top:16px;padding-top:15px;border-top:1px solid var(--jv-line)">
      <div class="jc-label" style="margin-bottom:8px">Nota privada (solo la ves tú)</div>
      <textarea id="jcNota" style="width:100%;box-sizing:border-box;background:rgba(0,0,0,.3);border:1px solid var(--jv-line);border-radius:12px;color:var(--jv-text);font-size:12.5px;padding:12px 14px;font-family:var(--jv-ui);resize:vertical;min-height:62px;outline:none;line-height:1.55" placeholder="Ej: llamó por lesión de rodilla · prefiere cenas rápidas · reactivar en enero...">${_esc(c.notaAdmin || '')}</textarea>
      <div style="display:flex;justify-content:flex-end;margin-top:8px">
        <button onclick="guardarNotaCliente('${c.id}', this)" style="background:rgba(61,220,151,.13);border:1px solid rgba(61,220,151,.3);border-radius:10px;color:var(--jv-ok);font-size:12px;padding:8px 18px;cursor:pointer;font-family:var(--jv-ui);font-weight:700">Guardar nota</button>
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:18px;padding-top:15px;border-top:1px solid var(--jv-line)">
      <button style="flex:1;padding:12px;font-size:12.5px;font-weight:700;font-family:var(--jv-ui);border:none;border-radius:12px;cursor:pointer;color:var(--jv-text);letter-spacing:-.01em;background:${c.isBeta ? 'rgba(255,94,94,.16)' : 'linear-gradient(135deg,var(--jv-accent),#E8471B)'};${c.isBeta ? 'color:var(--jv-bad);box-shadow:inset 0 0 0 1px rgba(255,94,94,.3)' : 'box-shadow:0 4px 16px rgba(255,95,46,.26)'}" onclick="togglePremiumCliente('${c.id}', ${!c.isBeta}, this)">
        ${c.isBeta ? 'Quitar premium' : 'Dar premium (1 año)'}
      </button>
      <a href="mailto:${_esc(c.email)}" style="flex:1;padding:12px;font-size:12.5px;font-weight:600;font-family:var(--jv-ui);text-align:center;text-decoration:none;color:var(--jv-dim);background:var(--jv-glass);border:1px solid var(--jv-line);border-radius:12px;box-sizing:border-box">
        Enviar email
      </a>
    </div>
    <!-- Qué entrenamiento y qué comidas tiene AHORA MISMO el cliente, tal
         cual se las generó el motor -- no se piden solas con la ficha (el
         plan pesa 200-400KB) sino al pulsar, una sola vez por apertura. -->
    <div style="margin-top:10px">
      <button class="jv-btn-flat jv-btn-flat-dim" id="jcBtnVerPlan" style="width:100%;justify-content:center" onclick="verPlanActualCliente('${c.id}', this)">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        Ver plan actual
      </button>
      <div id="jcPlanBox" style="display:none;margin-top:10px"></div>
    </div>
    <!-- Rehacer el plan con el motor de HOY. Hace falta cuando se arregla un
         fallo del motor (un alérgeno que se colaba, un alimento rechazado que
         no se filtraba): los clientes que ya tienen el plan guardado se quedan
         con el viejo hasta que hacen check-in o cambian algo por su cuenta. -->
    <div style="margin-top:10px">
      <button class="jv-btn-flat jv-btn-flat-accent" style="width:100%;justify-content:center" onclick="regenerarPlanCliente('${c.id}', this)">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
        Regenerar plan
      </button>
      <div style="font-size:10.5px;color:var(--jv-faint);text-align:center;margin-top:6px;font-family:var(--jv-ui);line-height:1.45">
        Rehace su entrenamiento y su dieta con sus mismas respuestas. Úsalo tras arreglar algo del motor.
      </div>
    </div>
    <div style="margin-top:14px;text-align:center">
      <button onclick="borrarCliente('${c.id}','${_esc((c.nombre || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'"))}','${_esc((c.email || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'"))}',this)" style="background:none;border:1px solid var(--jv-line);border-radius:10px;color:var(--jv-faint);font-size:12px;padding:9px 20px;cursor:pointer;font-family:var(--jv-ui);font-weight:600;transition:all .2s" onmouseenter="this.style.borderColor='rgba(255,94,94,.4)';this.style.color='var(--jv-bad)'" onmouseleave="this.style.borderColor='var(--jv-line)';this.style.color='var(--jv-faint)'">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:5px"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        Eliminar cliente
      </button>
    </div>
  `;
  const modal = document.getElementById('modalJarvisCliente');
  if (modal) modal.classList.add('visible');
}

function cerrarDetalleCliente() {
  const modal = document.getElementById('modalJarvisCliente');
  if (modal) modal.classList.remove('visible');
}

// Rehace el plan de un cliente con el motor actual, sin tocar sus respuestas.
//
// El motor (buildPlanFromData) vive aquí, en el navegador, así que el plan se
// construye en ESTE navegador -- el del admin -- y el endpoint solo lee el
// userdata del cliente y le escribe el plan nuevo, que son las dos partes que
// necesitan permisos de servicio.
//
// El cliente lo recibe la próxima vez que abra la app: syncProfileFromSupabase
// vuelca el `plan` del servidor sobre la copia local.
async function regenerarPlanCliente(userId, btn) {
  const original = btn.textContent.trim();
  btn.disabled = true; btn.textContent = 'Regenerando...';
  try {
    const { data: { session } } = await supa.auth.getSession();
    const pedir = (body) => fetch('/api/admin?fn=clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify(body)
    }).then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Error del servidor'); return j; });

    const { userdata } = await pedir({ accion: 'userdata', userId });
    if (!userdata) throw new Error('Este cliente no tiene datos del cuestionario');
    if (!userdata.onboardingCompletado) throw new Error('Este cliente aún no ha completado el cuestionario');

    const plan = buildPlanFromData(userdata);
    const r = await pedir({ accion: 'guardar_plan', userId, plan });

    // El servidor revisa el plan recién guardado con el agente de auditoría
    // (r.avisos: cuántos avisos quedan; null = no se pudo revisar).
    const revisado = typeof r.avisos === 'number';
    showToast(!revisado
      ? 'Plan regenerado. Lo verá la próxima vez que abra la app.'
      : r.avisos === 0
        ? 'Plan regenerado y revisado: ya no tiene ningún aviso.'
        : `Plan regenerado, pero sigue con ${r.avisos} aviso${r.avisos === 1 ? '' : 's'}. Si no desaparece, es un fallo del motor.`, 7000);
    btn.textContent = 'Plan regenerado';
    // Jarvis se recarga para que la ficha, la tabla y el Centro de acción
    // enseñen el resultado de la revisión (el aviso rojo desaparece ya).
    if (revisado) { cerrarDetalleCliente(); abrirPanelAdmin(); }
    // Que no se pueda pulsar dos veces seguidas sin querer: rehacerlo otra vez
    // no aporta nada y cada pulsación escribe en la fila del cliente.
    setTimeout(() => { btn.disabled = false; btn.textContent = original; }, 4000);
  } catch (e) {
    console.warn('[jarvis] regenerar plan:', e.message);
    showToast('No se pudo regenerar: ' + e.message, 6000);
    btn.disabled = false; btn.textContent = original;
  }
}

// Enseña en Jarvis el entrenamiento y la alimentación que el cliente tiene
// AHORA MISMO guardados -- tal cual, no sus respuestas del cuestionario
// (eso ya se ve más arriba en la ficha) sino el plan que de verdad le
// generó el motor y, en nutrición, la opción que él mismo ha elegido cada
// día (userdata.comidasSemana), no siempre la primera de la lista.
//
// Se pide solo al pulsar, una vez por apertura de la ficha: el plan pesa
// 200-400KB y cargarlo con cada ficha (aunque el admin solo quiera ver el
// estado de pago) sería tirar ancho de banda a la basura.
async function verPlanActualCliente(userId, btn) {
  const box = document.getElementById('jcPlanBox');
  if (!box) return;
  if (box.dataset.cargado === '1') {
    const visible = box.style.display !== 'none';
    box.style.display = visible ? 'none' : '';
    btn.lastChild.textContent = visible ? 'Ver plan actual' : 'Ocultar plan actual';
    return;
  }
  btn.disabled = true; btn.lastChild.textContent = 'Cargando...';
  try {
    const { data: { session } } = await supa.auth.getSession();
    const r = await fetch('/api/admin?fn=clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ accion: 'userdata', userId })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Error del servidor');
    box.innerHTML = j.plan ? _renderPlanClienteJarvis(j.userdata || {}, j.plan)
      : '<p style="font-size:12px;color:var(--jv-faint);text-align:center;padding:8px 0">Este cliente todavía no tiene un plan generado.</p>';
    box.style.display = '';
    box.dataset.cargado = '1';
    btn.lastChild.textContent = 'Ocultar plan actual';
  } catch (e) {
    console.warn('[jarvis] ver plan actual:', e.message);
    showToast('No se pudo cargar el plan: ' + e.message, 5000);
    btn.lastChild.textContent = 'Ver plan actual';
  } finally {
    btn.disabled = false;
  }
}

// Construye el HTML de solo lectura para verPlanActualCliente(). Mismo
// criterio que ya usa el PDF del cliente (generarPdfSemanal): si el día
// trae `ejercicios` estructurados se listan, si no se cae al `detalle` en
// texto (running y demás deportes que no usan esa estructura); en
// nutrición, la opción elegida de cada toma viene de comidasSemana y si el
// cliente no ha tocado nada se asume la primera (índice 0), igual que hace
// el propio dashboard del cliente.
// Separa por coma SIN partir las que van dentro de un paréntesis -- el
// detalle de un ejercicio trae notas tipo "3×12 (baja completo, aprieta 1s
// abajo, sube resistiendo)" y un split() normal rompía esa nota en tres
// líneas sueltas dentro de la ficha de Jarvis.
function _splitFueraDeParentesis(texto, sep) {
  const partes = [];
  let actual = '', profundidad = 0;
  for (const ch of texto) {
    if (ch === '(') profundidad++;
    else if (ch === ')') profundidad = Math.max(0, profundidad - 1);
    if (ch === sep && profundidad === 0) { partes.push(actual); actual = ''; }
    else actual += ch;
  }
  if (actual) partes.push(actual);
  return partes;
}

function _renderPlanClienteJarvis(userdata, plan) {
  const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const comidasCliente = Array.isArray(userdata.comidasSemana) ? userdata.comidasSemana : [];
  let html = '';

  // Cada día es un <details> nativo, plegado por defecto: con 7 días de
  // entreno + 7 de nutrición, tenerlo todo desplegado a la vez hacía la
  // ficha kilométrica. El admin abre solo el día que le interesa.
  const _chevron = `<svg class="jc-plan-chevron" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;color:var(--jv-faint);transition:transform .15s"><polyline points="9 6 15 12 9 18"/></svg>`;

  if (plan.semana && plan.semana.length && !plan.soloDieta) {
    html += `<div class="jc-label" style="margin-bottom:8px">Entrenamiento de esta semana</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:18px">`;
    plan.semana.forEach((dia, i) => {
      const esDescanso = dia.tipo === 'Descanso';
      const nombreDia = _esc(dia.dia || DIAS[i] || '');
      const etiqueta = esDescanso ? 'Descanso' : _esc(dia.split || dia.resumen || '');
      if (esDescanso) {
        html += `<div style="background:var(--jv-glass);border:1px solid var(--jv-line);border-radius:10px;padding:10px 12px;display:flex;justify-content:space-between;align-items:baseline;gap:8px">
          <span style="font-size:11.5px;font-weight:700;color:var(--jv-text)">${nombreDia}</span>
          <span style="font-size:10.5px;color:var(--jv-faint)">${etiqueta}</span>
        </div>`;
        return;
      }
      // dia.detalle suele venir como "Zona del cuerpo · ejercicio 3x10,
      // ejercicio 3x12, ..." -- la parte antes del primer " · " ya se
      // enseña en la etiqueta del resumen, así que se quita de aquí para
      // no repetirla, y el resto se parte por comas en FILAS propias --
      // antes iba todo en un único párrafo corrido y con 6-8 ejercicios
      // quedaba ilegible ("apelotonado").
      let items = [];
      if (dia.ejercicios && dia.ejercicios.length) {
        items = dia.ejercicios.map(ej => ej.nombre || ej);
      } else if (dia.detalle) {
        const puntoIdx = dia.detalle.indexOf(' · ');
        const cuerpo = puntoIdx !== -1 ? dia.detalle.slice(puntoIdx + 3) : dia.detalle;
        items = _splitFueraDeParentesis(cuerpo, ',').map(s => s.trim()).filter(Boolean);
      }
      html += `<details class="jc-plan-dia">
        <summary style="background:var(--jv-glass);border:1px solid var(--jv-line);border-radius:10px;padding:10px 12px;display:flex;justify-content:space-between;align-items:baseline;gap:8px;cursor:pointer">
          <span style="display:flex;align-items:center;gap:6px">${_chevron}<span style="font-size:11.5px;font-weight:700;color:var(--jv-text)">${nombreDia}</span></span>
          <span style="font-size:10.5px;color:var(--jv-dim);text-align:right">${etiqueta}</span>
        </summary>
        ${items.length ? `<div style="border:1px solid var(--jv-line);border-top:0;border-radius:0 0 10px 10px;padding:8px 12px 10px;margin-top:-1px;display:flex;flex-direction:column;gap:3px">
          ${items.map(it => `<div style="font-size:11px;color:var(--jv-faint);line-height:1.4">· ${_esc(it)}</div>`).join('')}
        </div>` : ''}
      </details>`;
    });
    html += `</div>`;
  }

  const frecuencia = userdata.comidas ? ` · ${_esc(userdata.comidas)}` : '';
  html += `<div class="jc-label" style="margin-bottom:8px">Alimentación que está siguiendo${frecuencia}</div>
    <div style="display:flex;flex-direction:column;gap:8px">`;
  DIAS.forEach((nombreDia, diaIdx) => {
    const tomasDia = _tomasDia(diaIdx, plan, comidasCliente[diaIdx] || []);
    if (!tomasDia.length) return;
    const filas = tomasDia.map((meal, mealIdx) => {
      const optIdx = (comidasCliente[diaIdx] && comidasCliente[diaIdx][mealIdx]) || 0;
      const opt = meal.opciones && meal.opciones[optIdx];
      if (!opt) return '';
      return `<div style="font-size:11px;color:var(--jv-faint);line-height:1.6"><span style="color:var(--jv-dim);font-weight:600">${_esc(meal.momento)}:</span> ${_esc(opt.nombre)}</div>`;
    }).join('');
    if (!filas) return;
    html += `<details class="jc-plan-dia">
      <summary style="background:var(--jv-glass);border:1px solid var(--jv-line);border-radius:10px;padding:9px 12px;display:flex;align-items:center;gap:6px;cursor:pointer">
        ${_chevron}<span style="font-size:11.5px;font-weight:700;color:var(--jv-text)">${_esc(nombreDia)}</span>
      </summary>
      <div style="border:1px solid var(--jv-line);border-top:0;border-radius:0 0 10px 10px;padding:8px 12px 9px;margin-top:-1px">
        ${filas}
      </div>
    </details>`;
  });
  html += `</div>`;
  return html;
}

// Cierre MANUAL del aviso del agente de auditoría (12 sept 2026): para
// cuando el admin ya ha comprobado el plan por su cuenta -- o ha decidido
// que no hace falta esperar a que el cliente conteste el pop-up -- y
// quiere quitar el aviso sin pasar por "Regenerar plan". Solo cierra la
// fila, no toca el plan del cliente: si el fallo de verdad sigue ahí, el
// agente automático (al guardar un plan nuevo, al Regenerar, o en el cron
// diario) lo vuelve a abrir solo -- esto no es un "silenciar para siempre".
async function marcarRevisionHecha(userId, btn) {
  const original = btn.textContent.trim();
  btn.disabled = true; btn.textContent = 'Marcando...';
  try {
    const { data: { session } } = await supa.auth.getSession();
    const res = await fetch('/api/admin?fn=clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ accion: 'marcar_revision_hecha', userId })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Error del servidor');
    showToast('Revisión marcada como hecha. Si el fallo sigue en el plan, el robot lo volverá a avisar.', 6000);
    // Recarga Jarvis para que la tarjeta roja, el badge de la tabla y el
    // Centro de acción desaparezcan ya, sin esperar al próximo repaso.
    cerrarDetalleCliente();
    abrirPanelAdmin();
  } catch (e) {
    console.warn('[jarvis] marcar revisión hecha:', e.message);
    showToast('No se pudo marcar: ' + e.message, 6000);
    btn.disabled = false; btn.textContent = original;
  }
}

async function togglePremiumCliente(userId, premium, btn) {
  if (premium) {
    const cli = (_adminDatos?.clientes || []).find(x => x.id === userId);
    if (cli && ['active', 'trialing', 'past_due', 'unpaid'].includes(cli.estadoStripe)
      && !confirm('Este cliente tiene una suscripción de Stripe. Al darle premium se cancela ya y no se le cobra nada más. ¿Seguir?')) return;
  }
  btn.disabled = true;
  btn.textContent = 'Actualizando...';
  try {
    const { data: { session } } = await supa.auth.getSession();
    const res = await fetch('/api/admin?fn=set-premium', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ userId, premium })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (!premium) showToast('Premium desactivado');
    else if (data.avisos && data.avisos.length) showToast('Premium activado, pero Stripe no dejó cancelar su suscripción: ' + data.avisos[0] + ' Cancélala a mano en Stripe.', 9000);
    else if (data.stripeCanceladas) showToast('Premium activado. Su suscripción de Stripe queda cancelada: no se le cobrará nada.', 6000);
    else showToast('Premium activado. No se le cobrará nada.');
    cerrarDetalleCliente();
    abrirPanelAdmin();
  } catch (e) {
    showToast('Error: ' + e.message, 4000);
    btn.disabled = false;
    btn.textContent = premium ? 'Dar premium (1 año)' : 'Quitar premium';
  }
}

// Premium concedido antes de que "Dar premium" cancelara Stripe solo: corta
// la suscripción que le quede detrás sin tocar la caducidad del premium.
async function detenerStripeCliente(userId, btn) {
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = 'Cancelando...';
  try {
    const { data: { session } } = await supa.auth.getSession();
    const res = await fetch('/api/admin?fn=set-premium', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ userId, accion: 'detener_stripe' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (data.avisos && data.avisos.length) throw new Error(data.avisos[0]);
    showToast(data.stripeCanceladas ? 'Suscripción de Stripe cancelada: no se le cobrará nada.' : 'No le quedaba ninguna suscripción de Stripe que cobrar.', 6000);
    cerrarDetalleCliente();
    abrirPanelAdmin();
  } catch (e) {
    showToast('Error: ' + e.message, 6000);
    btn.disabled = false;
    btn.textContent = original;
  }
}

// ===== PANEL DE EMAILS: tipos, filtros y render =====
const _emailTipoLabel = { lead: 'Email de plan al lead', bienvenida: 'Email de bienvenida', opinion: 'Notificación de opinión', mensaje: 'Mensaje de cliente', resumen_semanal: 'Resumen semanal', retencion_dia3: 'Retención día 3', retencion_dia8: 'Retención día 8', reenganche_7d: 'Re-engagement 7 días', reenganche_14d: 'Re-engagement 14 días', reenganche_21d: 'Re-engagement 21 días', renovacion: 'Email de renovación', digest_admin: 'Digest admin diario', auditoria_plan: 'Aviso del agente de revisión', retencion_tarjeta: 'Retención: plan hecho sin activar', aviso_primer_cobro: 'Aviso: termina el mes gratis', prueba_sin_entrenar: 'Mes gratis: primer entreno', prueba_sin_tarjeta: 'Mes gratis: añade tu tarjeta', pago_fallido: 'Pago fallido', plan_invitado: 'Plan por email (sin cuenta)', recordatorio_plan_invitado: 'Recordatorio al invitado', push_recordatorio_diario: 'Aviso diario al móvil', generico: 'Correo' };
// Paleta por tipo de email: familias distinguibles entre sí (naranja de marca
// para captación, verde para altas, azul/violeta para informes, y rojos cada
// vez más intensos para los 3 niveles de re-enganche).
// OJO: aquí van hex literales a propósito, NO var(--jv-*): estos valores se
// concatenan con sufijos de opacidad más abajo (`${color}18`), y "var(...)18"
// no es CSS válido -- el fondo se perdería en silencio.
const _emailTipoColor = { lead: '#FF5F2E', bienvenida: '#3DDC97', opinion: '#FFC53D', mensaje: '#52A9FF', resumen_semanal: '#A78BFA', retencion_dia3: '#FFA766', retencion_dia8: '#FF8A4C', reenganche_7d: '#FF7A7A', reenganche_14d: '#FF5E5E', reenganche_21d: '#E23F3F', renovacion: '#2DD4BF', digest_admin: '#8B909C', retencion_tarjeta: '#FFA766', aviso_primer_cobro: '#2DD4BF', prueba_sin_entrenar: '#52A9FF', prueba_sin_tarjeta: '#2DD4BF', pago_fallido: '#E23F3F', plan_invitado: '#FF5F2E', recordatorio_plan_invitado: '#FF8A4C', push_recordatorio_diario: '#8B909C', auditoria_plan: '#A78BFA', generico: '#8B909C' };
function _emailIcon(tipo) {
  const c = _emailTipoColor[tipo] || 'var(--jv-faint)';
  const iconos = {
    lead: `<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>`,
    bienvenida: `<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`,
    opinion: `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`,
    resumen_semanal: `<path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-5"/>`,
    retencion_dia3: `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
    retencion_dia8: `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
    reenganche_7d: `<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
    reenganche_14d: `<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
    reenganche_21d: `<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
    renovacion: `<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>`,
    digest_admin: `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
    mensaje: `<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>`
  };
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${c}" stroke-width="2">${iconos[tipo] || iconos.mensaje}</svg>`;
}

// Rellena el desplegable de tipos con los que existan en el log (conserva la selección).
function poblarFiltroTipoEmail() {
  const sel = document.getElementById('emailFiltroTipo');
  if (!sel) return;
  const tipos = [...new Set(_adminEmailLog.map(e => e.tipo))].sort();
  const actual = sel.value;
  sel.innerHTML = '<option value="">Todos los tipos</option>' +
    tipos.map(t => `<option value="${_esc(t)}">${_esc(_emailTipoLabel[t] || t)}</option>`).join('');
  if (tipos.includes(actual)) sel.value = actual;
  sel._jvSync && sel._jvSync(); // sincroniza la etiqueta del botón (ver _mejorarSelects)
}

function limpiarFiltrosEmail() {
  ['emailFiltroTexto', 'emailFiltroDesde', 'emailFiltroHasta', 'emailFiltroTipo', 'emailFiltroEstado']
    .forEach(id => { const el = document.getElementById(id); if (el) { el.value = ''; el._jvSync && el._jvSync(); } });
  renderAdminEmails();
}

// Renderiza la lista de emails aplicando los filtros activos (texto, tipo, estado, fechas).
function renderAdminEmails() {
  const list = document.getElementById('adminEmailsList');
  if (!list) return;
  const q      = (document.getElementById('emailFiltroTexto')?.value || '').trim().toLowerCase();
  const tipoF  = document.getElementById('emailFiltroTipo')?.value || '';
  const estadoF = document.getElementById('emailFiltroEstado')?.value || '';
  const desde  = document.getElementById('emailFiltroDesde')?.value || '';
  const hasta  = document.getElementById('emailFiltroHasta')?.value || '';
  const desdeTs = desde ? new Date(desde + 'T00:00:00').getTime() : null;
  const hastaTs = hasta ? new Date(hasta + 'T23:59:59').getTime() : null;
  const fmtHora = (iso) => iso ? new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
  const parseDatos = (e) => { try { return typeof e.datos === 'string' ? JSON.parse(e.datos) : (e.datos || {}); } catch (x) { return {}; } };

  const filtrados = _adminEmailLog.filter(e => {
    const d = parseDatos(e);
    if (tipoF && e.tipo !== tipoF) return false;
    if (estadoF === 'gestionado' && !d.gestionado) return false;
    if (estadoF === 'pendiente' && d.gestionado) return false;
    if (desdeTs || hastaTs) {
      const ts = e.created_at ? new Date(e.created_at).getTime() : 0;
      if (desdeTs && ts < desdeTs) return false;
      if (hastaTs && ts > hastaTs) return false;
    }
    if (q) {
      const cuerpo = d.resumen || d.mensaje || d.texto || '';
      const heno = [e.destinatario, e.asunto, e.tipo, _emailTipoLabel[e.tipo] || '', cuerpo].join(' ').toLowerCase();
      if (!heno.includes(q)) return false;
    }
    return true;
  });

  const countEl = document.getElementById('adminEmailsCount');
  if (countEl) countEl.textContent = filtrados.length === _adminEmailLog.length
    ? `${_adminEmailLog.length} emails`
    : `${filtrados.length} de ${_adminEmailLog.length}`;

  // Selección múltiple: solo tiene sentido sobre emails con id real (los
  // legacy sin id tampoco se pueden borrar uno a uno, ver más abajo). Se
  // podan aquí los ids seleccionados que ya no están en los filtrados
  // (cambiaron los filtros, o se borraron) para que "Seleccionar todos" y
  // el contador no arrastren ids fantasma.
  _adminEmailsFiltradosIds = filtrados.filter(e => e.id != null).map(e => String(e.id));
  const filtradosSet = new Set(_adminEmailsFiltradosIds);
  _emailsSeleccionados.forEach(id => { if (!filtradosSet.has(id)) _emailsSeleccionados.delete(id); });

  if (_adminEmailLog.length === 0) {
    list.innerHTML = '<p style="color:var(--jv-faint);font-size:13px">Aún no hay emails enviados.</p>';
    _actualizarBarraSeleccionEmails();
    return;
  }
  if (filtrados.length === 0) {
    list.innerHTML = '<p style="color:var(--jv-faint);font-size:13px;padding:8px 2px">Ningún email coincide con los filtros. <a onclick="limpiarFiltrosEmail()" style="color:var(--jv-accent);cursor:pointer;text-decoration:underline">Limpiar filtros</a></p>';
    _actualizarBarraSeleccionEmails();
    return;
  }

  list.innerHTML = filtrados.map((e, i) => {
    const color = _emailTipoColor[e.tipo] || '#8B909C'; // hex: se concatena con opacidad más abajo
    const icon = _emailIcon(e.tipo);
    const d = parseDatos(e);
    let cuerpoPreview = '';
    if (d.resumen) cuerpoPreview = d.resumen;
    else if (d.mensaje) cuerpoPreview = d.mensaje;
    else if (d.texto) cuerpoPreview = d.texto;
    else if (d.nombre && d.email) cuerpoPreview = 'Para: ' + d.nombre + ' (' + d.email + ')';
    else if (d.email) cuerpoPreview = 'Para: ' + d.email;
    const esGestionado = !!d.gestionado;
    const gestionadoId = e.id || i;
    const seleccionable = e.id != null;
    const seleccionado = seleccionable && _emailsSeleccionados.has(String(e.id));
    return `
    <div id="email-row-${gestionadoId}" style="background:var(--jv-glass);border:1px solid ${seleccionado ? 'var(--jv-accent)' : esGestionado ? 'rgba(61,220,151,0.22)' : 'var(--jv-line)'};border-radius:12px;overflow:hidden;transition:all .2s;opacity:${esGestionado ? '0.72' : '1'}">
      <div onclick="this.parentElement.querySelector('.email-body').classList.toggle('email-body-open');this.querySelector('.email-chevron').classList.toggle('email-chevron-open')" style="padding:14px 18px;display:flex;align-items:center;gap:14px;cursor:pointer;transition:background .15s;border-left:3px solid ${esGestionado ? 'var(--jv-ok)' : 'transparent'}" onmouseenter="this.style.background='var(--jv-glass-hi)'" onmouseleave="this.style.background='transparent'">
        ${seleccionable
          ? '<input type="checkbox" ' + (seleccionado ? 'checked ' : '') + 'aria-label="Seleccionar ' + _esc(_emailTipoLabel[e.tipo] || e.tipo) + ' a ' + _esc(e.destinatario || '') + '" onclick="event.stopPropagation()" onchange="toggleSeleccionEmail(\'' + String(e.id).replace(/\\/g,'\\\\').replace(/'/g,"\\'") + '\',this.checked)" style="width:16px;height:16px;flex-shrink:0;accent-color:var(--jv-accent);cursor:pointer">'
          : '<span style="width:16px;flex-shrink:0"></span>'}
        <div style="width:36px;height:36px;border-radius:10px;background:${color}15;border:1px solid ${color}30;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${icon}
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;flex-wrap:wrap">
            <span style="font-size:13px;color:var(--jv-text);font-weight:600">${_esc(_emailTipoLabel[e.tipo] || e.tipo)}</span>
            <span style="font-size:9px;padding:2px 7px;border-radius:4px;background:${color}18;color:${color};font-family:var(--jv-ui);font-weight:600;text-transform:uppercase;letter-spacing:.5px">${_esc(e.tipo)}</span>
            ${esGestionado ? '<span style="font-size:9px;padding:2px 7px;border-radius:4px;background:rgba(61,220,151,0.09);color:var(--jv-ok);font-family:var(--jv-ui);font-weight:600;font-weight:600">✓ VISTO</span>' : ''}
          </div>
          <div style="font-size:12px;color:var(--jv-faint);display:flex;align-items:center;gap:6px">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(e.destinatario)}</span>
            ${e.asunto ? '<span style="color:var(--jv-line)">·</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _esc(e.asunto) + '</span>' : ''}
          </div>
        </div>
        <div style="flex-shrink:0;text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:2px">
          <div style="font-family:var(--jv-ui);font-weight:600;font-size:11px;color:var(--jv-faint)">${_fmtFecha(e.created_at)}</div>
          <div style="font-family:var(--jv-ui);font-weight:600;font-size:10px;color:var(--jv-faint)">${fmtHora(e.created_at)}</div>
        </div>
        <svg class="email-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--jv-faint)" stroke-width="2" style="flex-shrink:0;transition:transform .2s"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="email-body" style="max-height:0;overflow:hidden;transition:max-height .3s ease">
        <div style="padding:0 18px 16px;font-size:12px;color:var(--jv-dim);line-height:1.6">
          <div style="border-top:1px solid var(--jv-line);padding-top:14px">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px">
              <div style="font-size:10px;color:var(--jv-accent);font-family:var(--jv-ui);font-weight:600;letter-spacing:.5px;text-transform:uppercase">${e.html ? 'Email tal como se envió' : 'Contenido del email'}</div>
              <div style="display:flex;align-items:center;gap:8px">
                ${esGestionado
                  ? '<span style="font-size:10px;color:var(--jv-ok);font-family:var(--jv-ui);font-weight:600;font-weight:600;display:flex;align-items:center;gap:4px"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Gestionado</span>'
                  : '<button onclick="event.stopPropagation();marcarEmailGestionado(\'' + String(gestionadoId).replace(/\\/g,'\\\\').replace(/'/g,"\\'") + '\',this)" class="jv-btn jv-btn-success" style="padding:7px 14px;font-size:11px"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Marcar como visto</button>'}
                ${e.id ? '<button onclick="event.stopPropagation();eliminarEmail(\'' + String(e.id).replace(/\\/g,'\\\\').replace(/'/g,"\\'") + '\',this)" class="jv-btn jv-btn-danger" style="padding:7px 12px;font-size:11px"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg> Eliminar</button>' : ''}
              </div>
            </div>
            ${e.html
              // sandbox="allow-same-origin" (sin allow-scripts, así que sigue sin poder
              // ejecutar nada): sin esto, el iframe tiene un origen opaco para el
              // navegador y la cabecera Cross-Origin-Resource-Policy: same-origin de
              // vercel.json bloquea la imagen de cabecera del email (y cualquier otra
              // imagen propia que use la plantilla) -- se veía bien en el email real
              // (un cliente de correo no aplica las cabeceras de seguridad de la web),
              // pero no en esta vista previa dentro de Jarvis.
              ? '<iframe srcdoc="' + _esc(e.html) + '" sandbox="allow-same-origin" style="width:100%;height:520px;border:1px solid var(--jv-line);border-radius:8px;background:rgba(0,0,0,.3)" title="Vista previa del email"></iframe>'
              : cuerpoPreview
              ? '<div style="background:rgba(0,0,0,.3);border:1px solid var(--jv-line);border-radius:8px;padding:14px 16px;white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.7;color:var(--jv-dim)">' + _esc(cuerpoPreview) + '</div>'
              : '<div style="background:rgba(0,0,0,.3);border:1px solid var(--jv-line);border-radius:8px;padding:14px 16px;color:var(--jv-faint);font-style:italic">Los emails anteriores a esta actualización no tienen contenido guardado. Los nuevos sí lo mostrarán.</div>'}
            <div style="margin-top:12px;display:flex;gap:14px;flex-wrap:wrap;font-size:10px;color:var(--jv-faint);font-family:var(--jv-ui);font-weight:600">
              <span>Tipo: ${_esc(e.tipo)}</span>
              <span>Destino: ${_esc(e.destinatario)}</span>
              <span>${_fmtFecha(e.created_at)} ${fmtHora(e.created_at)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
  _actualizarBarraSeleccionEmails();
}

// ===== SELECCIÓN MÚLTIPLE DE EMAILS =====
function _actualizarBarraSeleccionEmails() {
  const n = _emailsSeleccionados.size;
  const bar = document.getElementById('emailSeleccionBar');
  if (bar) bar.style.display = n > 0 ? 'flex' : 'none';
  const countEl = document.getElementById('emailSeleccionCount');
  if (countEl) countEl.textContent = `${n} email${n === 1 ? '' : 's'} seleccionado${n === 1 ? '' : 's'}`;
  const todos = document.getElementById('emailSeleccionarTodos');
  if (todos) {
    const total = _adminEmailsFiltradosIds.length;
    const marcados = _adminEmailsFiltradosIds.filter(id => _emailsSeleccionados.has(id)).length;
    todos.checked = total > 0 && marcados === total;
    todos.indeterminate = marcados > 0 && marcados < total;
  }
}

function toggleSeleccionEmail(id, checked) {
  const idStr = String(id);
  if (checked) _emailsSeleccionados.add(idStr);
  else _emailsSeleccionados.delete(idStr);
  const row = document.getElementById('email-row-' + idStr);
  if (row) row.style.borderColor = checked ? 'var(--jv-accent)' : 'var(--jv-line)';
  _actualizarBarraSeleccionEmails();
}

function toggleSeleccionarTodosEmails(checked) {
  if (checked) _adminEmailsFiltradosIds.forEach(id => _emailsSeleccionados.add(id));
  else _emailsSeleccionados.clear();
  renderAdminEmails();
}

function cancelarSeleccionEmails() {
  _emailsSeleccionados.clear();
  renderAdminEmails();
}

// Marca como vistos todos los emails seleccionados (peticiones en paralelo,
// igual que la acción individual pero para varios ids a la vez).
async function marcarSeleccionadosGestionados() {
  const ids = [..._emailsSeleccionados];
  if (!ids.length) return;
  const btn = document.getElementById('btnMarcarSeleccionados');
  const txtOriginal = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Marcando...'; }
  try {
    const { data: { session } } = await supa.auth.getSession();
    const resultados = await Promise.allSettled(ids.map(id => fetch('/api/admin?fn=mensaje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ accion: 'email_gestionado', id })
    }).then(r => r.json().then(d => { if (!r.ok) throw new Error(d.error); }))));
    const fallos = resultados.filter(r => r.status === 'rejected').length;
    ids.forEach(id => {
      const rec = _adminEmailLog.find(x => String(x.id) === id);
      if (rec) {
        let d = {};
        try { d = typeof rec.datos === 'string' ? JSON.parse(rec.datos) : (rec.datos || {}); } catch (_) {}
        d.gestionado = true;
        d.gestionado_at = new Date().toISOString();
        rec.datos = JSON.stringify(d);
      }
    });
    _emailsSeleccionados.clear();
    renderAdminEmails();
    showToast(fallos ? `Marcados ${ids.length - fallos} de ${ids.length} (${fallos} con error)` : `${ids.length} email(s) marcados como vistos`);
  } catch (e) {
    showToast('Error: ' + e.message, 4000);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = txtOriginal || 'Marcar como vistos'; }
  }
}

// Reutiliza la acción "eliminar_emails_masivo" que ya existía para "Eliminar
// filtrados", pero sobre los ids marcados a mano en vez de todo lo filtrado.
async function eliminarSeleccionados() {
  const ids = [..._emailsSeleccionados];
  if (!ids.length) return;
  if (!confirm(`¿Eliminar ${ids.length} email(s) seleccionados? Esta acción no se puede deshacer.`)) return;
  const btn = document.getElementById('btnEliminarSeleccionados');
  const txtOriginal = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Eliminando...'; }
  try {
    const { data: { session } } = await supa.auth.getSession();
    const res = await fetch('/api/admin?fn=mensaje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ accion: 'eliminar_emails_masivo', ids })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    const idsSet = new Set(ids);
    _adminEmailLog = _adminEmailLog.filter(x => !idsSet.has(String(x.id)));
    _emailsSeleccionados.clear();
    renderAdminEmails();
    showToast(`${ids.length} email(s) eliminados`);
  } catch (e) {
    showToast('Error: ' + e.message, 4000);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = txtOriginal || 'Eliminar seleccionados'; }
  }
}

// ===== SELECCIÓN MÚLTIPLE DE MENSAJES (BUZÓN) =====
function _actualizarBarraSeleccionMensajes() {
  const n = _mensajesSeleccionados.size;
  const bar = document.getElementById('mensajesSeleccionBar');
  if (bar) bar.style.display = n > 0 ? 'flex' : 'none';
  const countEl = document.getElementById('mensajesSeleccionCount');
  if (countEl) countEl.textContent = `${n} mensaje${n === 1 ? '' : 's'} seleccionado${n === 1 ? '' : 's'}`;
  const todos = document.getElementById('mensajesSeleccionarTodos');
  if (todos) {
    const total = _adminMensajesIds.length;
    const marcados = _adminMensajesIds.filter(id => _mensajesSeleccionados.has(id)).length;
    todos.checked = total > 0 && marcados === total;
    todos.indeterminate = marcados > 0 && marcados < total;
  }
}

function toggleSeleccionMensaje(id, checked) {
  const idStr = String(id);
  if (checked) _mensajesSeleccionados.add(idStr);
  else _mensajesSeleccionados.delete(idStr);
  const row = document.getElementById('mensaje-row-' + idStr);
  if (row) row.style.borderColor = checked ? 'var(--jv-accent)' : 'var(--jv-line)';
  _actualizarBarraSeleccionMensajes();
}

function toggleSeleccionarTodosMensajes(checked) {
  if (checked) _adminMensajesIds.forEach(id => _mensajesSeleccionados.add(id));
  else _mensajesSeleccionados.clear();
  renderAdminMensajes();
}

function cancelarSeleccionMensajes() {
  _mensajesSeleccionados.clear();
  renderAdminMensajes();
}

async function marcarSeleccionadosMensajesGestionados() {
  const ids = [..._mensajesSeleccionados];
  if (!ids.length) return;
  const btn = document.getElementById('btnMarcarMensajesSeleccionados');
  const txtOriginal = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Marcando...'; }
  try {
    const { data: { session } } = await supa.auth.getSession();
    const res = await fetch('/api/admin?fn=mensaje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ accion: 'mensajes_masivo_gestionado', ids })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    ids.forEach(id => {
      const rec = _adminMensajes.find(x => String(x.id) === id);
      if (rec) rec.respuesta = 'Gestionado';
    });
    _mensajesSeleccionados.clear();
    renderAdminMensajes();
    showToast(`${ids.length} mensaje(s) marcados como gestionados`);
  } catch (e) {
    showToast('Error: ' + e.message, 4000);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = txtOriginal || 'Marcar como gestionados'; }
  }
}

async function eliminarMensajesSeleccionados() {
  const ids = [..._mensajesSeleccionados];
  if (!ids.length) return;
  if (!confirm(`¿Eliminar ${ids.length} mensaje(s) seleccionados? Esta acción no se puede deshacer.`)) return;
  const btn = document.getElementById('btnEliminarMensajesSeleccionados');
  const txtOriginal = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Eliminando...'; }
  try {
    const { data: { session } } = await supa.auth.getSession();
    const res = await fetch('/api/admin?fn=mensaje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ accion: 'eliminar_mensajes_masivo', ids })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    const idsSet = new Set(ids);
    _adminMensajes = _adminMensajes.filter(x => !idsSet.has(String(x.id)));
    _mensajesSeleccionados.clear();
    renderAdminMensajes();
    showToast(`${ids.length} mensaje(s) eliminados`);
  } catch (e) {
    showToast('Error: ' + e.message, 4000);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = txtOriginal || 'Eliminar seleccionados'; }
  }
}

// ===== SELECCIÓN MÚLTIPLE DE LEADS =====
// Los leads no tienen estado "gestionado" (la tabla solo guarda email +
// fecha), así que la única acción en bloque real es eliminar.
function _actualizarBarraSeleccionLeads() {
  const n = _leadsSeleccionados.size;
  const bar = document.getElementById('leadsSeleccionBar');
  if (bar) bar.style.display = n > 0 ? 'flex' : 'none';
  const countEl = document.getElementById('leadsSeleccionCount');
  if (countEl) countEl.textContent = `${n} lead${n === 1 ? '' : 's'} seleccionado${n === 1 ? '' : 's'}`;
  const todos = document.getElementById('leadsSeleccionarTodos');
  if (todos) {
    const total = _adminLeadsIds.length;
    const marcados = _adminLeadsIds.filter(id => _leadsSeleccionados.has(id)).length;
    todos.checked = total > 0 && marcados === total;
    todos.indeterminate = marcados > 0 && marcados < total;
  }
}

function toggleSeleccionLead(id, checked) {
  const idStr = String(id);
  if (checked) _leadsSeleccionados.add(idStr);
  else _leadsSeleccionados.delete(idStr);
  const row = document.getElementById('lead-row-' + idStr);
  if (row) row.style.borderColor = checked ? 'var(--jv-accent)' : 'var(--jv-line)';
  _actualizarBarraSeleccionLeads();
}

function toggleSeleccionarTodosLeads(checked) {
  if (checked) _adminLeadsIds.forEach(id => _leadsSeleccionados.add(id));
  else _leadsSeleccionados.clear();
  renderAdminLeads();
}

function cancelarSeleccionLeads() {
  _leadsSeleccionados.clear();
  renderAdminLeads();
}

async function eliminarLeadsSeleccionados() {
  const ids = [..._leadsSeleccionados];
  if (!ids.length) return;
  if (!confirm(`¿Eliminar ${ids.length} lead(s) seleccionados? Esta acción no se puede deshacer.`)) return;
  const btn = document.getElementById('btnEliminarLeadsSeleccionados');
  const txtOriginal = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Eliminando...'; }
  try {
    const { data: { session } } = await supa.auth.getSession();
    const res = await fetch('/api/admin?fn=mensaje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ accion: 'eliminar_leads_masivo', ids })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    const idsSet = new Set(ids);
    _adminLeads = _adminLeads.filter(x => !idsSet.has(String(x.id)));
    _leadsSeleccionados.clear();
    renderAdminLeads();
    showToast(`${ids.length} lead(s) eliminados`);
  } catch (e) {
    showToast('Error: ' + e.message, 4000);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = txtOriginal || 'Eliminar seleccionados'; }
  }
}

async function guardarNotaCliente(userId, btn) {
  const ta = document.getElementById('jcNota');
  if (!ta) return;
  const nota = ta.value;
  const txt = btn.textContent;
  btn.disabled = true; btn.textContent = 'Guardando...';
  try {
    const { data: { session } } = await supa.auth.getSession();
    const res = await fetch('/api/admin?fn=mensaje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ accion: 'guardar_nota', userId, nota })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error guardando');
    const c = (_adminDatos?.clientes || []).find(x => x.id === userId);
    if (c) c.notaAdmin = nota;
    btn.textContent = '✓ Guardada';
    showToast('Nota guardada');
    setTimeout(() => { btn.textContent = txt; btn.disabled = false; }, 1500);
  } catch (e) {
    showToast('Error: ' + e.message, 4000);
    btn.disabled = false; btn.textContent = txt;
  }
}

async function marcarEmailGestionado(emailId, btn) {
  btn.disabled = true;
  btn.textContent = 'Marcando...';
  try {
    const { data: { session } } = await supa.auth.getSession();
    const res = await fetch('/api/admin?fn=mensaje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ accion: 'email_gestionado', id: emailId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    // Actualiza el dato en memoria para que el re-render muestre el estado "visto"
    // (fila atenuada + borde verde + badge) y para que el filtro por estado funcione.
    const rec = _adminEmailLog.find(x => String(x.id) === String(emailId));
    if (rec) {
      let d = {};
      try { d = typeof rec.datos === 'string' ? JSON.parse(rec.datos) : (rec.datos || {}); } catch (_) {}
      d.gestionado = true;
      d.gestionado_at = new Date().toISOString();
      rec.datos = JSON.stringify(d);
    }
    renderAdminEmails();
    showToast('Email marcado como visto');
  } catch (e) {
    showToast('Error: ' + e.message, 4000);
    btn.disabled = false;
    btn.textContent = 'Marcar como visto';
  }
}

async function eliminarEmail(emailId, btn) {
  if (!confirm('¿Eliminar este email del historial?')) return;
  if (btn) { btn.disabled = true; btn.textContent = 'Eliminando...'; }
  try {
    const { data: { session } } = await supa.auth.getSession();
    const res = await fetch('/api/admin?fn=mensaje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ accion: 'eliminar_email', id: emailId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    _adminEmailLog = _adminEmailLog.filter(x => String(x.id) !== String(emailId));
    renderAdminEmails();
    showToast('Email eliminado');
  } catch (e) {
    showToast('Error: ' + e.message, 4000);
    if (btn) { btn.disabled = false; btn.textContent = 'Eliminar'; }
  }
}

// Borra de golpe todos los emails que cumplen los filtros activos (tipo, texto,
// fechas, estado) — pensado para vaciar de una vez la acumulación de digests
// diarios en vez de eliminarlos uno a uno.
async function eliminarEmailsFiltrados() {
  const q      = (document.getElementById('emailFiltroTexto')?.value || '').trim().toLowerCase();
  const tipoF  = document.getElementById('emailFiltroTipo')?.value || '';
  const estadoF = document.getElementById('emailFiltroEstado')?.value || '';
  const desde  = document.getElementById('emailFiltroDesde')?.value || '';
  const hasta  = document.getElementById('emailFiltroHasta')?.value || '';
  const desdeTs = desde ? new Date(desde + 'T00:00:00').getTime() : null;
  const hastaTs = hasta ? new Date(hasta + 'T23:59:59').getTime() : null;
  const parseDatos = (e) => { try { return typeof e.datos === 'string' ? JSON.parse(e.datos) : (e.datos || {}); } catch (x) { return {}; } };
  const filtrados = _adminEmailLog.filter(e => {
    const d = parseDatos(e);
    if (tipoF && e.tipo !== tipoF) return false;
    if (estadoF === 'gestionado' && !d.gestionado) return false;
    if (estadoF === 'pendiente' && d.gestionado) return false;
    if (desdeTs || hastaTs) {
      const ts = e.created_at ? new Date(e.created_at).getTime() : 0;
      if (desdeTs && ts < desdeTs) return false;
      if (hastaTs && ts > hastaTs) return false;
    }
    if (q) {
      const cuerpo = d.resumen || d.mensaje || d.texto || '';
      const heno = [e.destinatario, e.asunto, e.tipo, _emailTipoLabel[e.tipo] || '', cuerpo].join(' ').toLowerCase();
      if (!heno.includes(q)) return false;
    }
    return true;
  });
  const ids = filtrados.map(e => e.id).filter(Boolean);
  if (!ids.length) { showToast('No hay emails que coincidan con los filtros'); return; }
  if (!confirm(`¿Eliminar ${ids.length} email(s) que coinciden con los filtros actuales? Esta acción no se puede deshacer.`)) return;
  try {
    const { data: { session } } = await supa.auth.getSession();
    const res = await fetch('/api/admin?fn=mensaje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ accion: 'eliminar_emails_masivo', ids })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    const idsSet = new Set(ids.map(String));
    _adminEmailLog = _adminEmailLog.filter(x => !idsSet.has(String(x.id)));
    renderAdminEmails();
    showToast(`${ids.length} email(s) eliminados`);
  } catch (e) { showToast('Error: ' + e.message, 4000); }
}

async function borrarCliente(userId, nombre, email, btn) {
  const confirmar = window.confirm(`¿Seguro que quieres ELIMINAR permanentemente a ${nombre} (${email})?\n\nEsto borrará:\n• Su cuenta de usuario\n• Su perfil y datos\n• Su suscripción\n\nEsta acción NO se puede deshacer.`);
  if (!confirmar) return;
  const confirmar2 = window.confirm(`Última confirmación: ¿Borrar a ${email} de la base de datos?`);
  if (!confirmar2) return;
  btn.disabled = true;
  btn.textContent = 'Eliminando...';
  try {
    const { data: { session } } = await supa.auth.getSession();
    const res = await fetch('/api/admin?fn=mensaje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ accion: 'borrar_cliente', userId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (data.avisos && data.avisos.length) {
      // El cliente se borró de K-ONE, pero algo en Stripe no se pudo limpiar
      // del todo (ver comentario en admin-mensaje.js) -- avisar de verdad,
      // no una notificación que desaparece sola en 4 segundos.
      window.alert('Cliente eliminado, pero con avisos que requieren revisión manual en Stripe:\n\n' + data.avisos.join('\n\n'));
    } else {
      showToast('Cliente eliminado correctamente');
    }
    cerrarDetalleCliente();
    abrirPanelAdmin();
  } catch (e) {
    showToast('Error: ' + e.message, 4000);
    btn.disabled = false;
    btn.textContent = 'Eliminar cliente';
  }
}


window._jarvisListo = true;
