/* =========================================================
   Playeras y Gorras: tienda simulada
   Carrito, tallas, cantidades, códigos de descuento y un
   pago de prueba. Nada se cobra: todo vive en el navegador.
   ========================================================= */
(() => {
    'use strict';

    /* ---------- Catálogo ---------- */
    const img = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&h=800&q=80`;

    const PRODUCTOS = [
        { id: 'playera-blanca', nombre: 'Playera Blanca', categoria: 'playeras', precio: 250, img: img('1581655353564-df123a1eb820'), alt: 'Playera blanca de cuello redondo' },
        { id: 'playera-negra', nombre: 'Playera Negra', categoria: 'playeras', precio: 250, img: img('1618354691373-d851c5c3a990'), alt: 'Playera negra de cuello redondo' },
        { id: 'playera-verde', nombre: 'Playera Verde', categoria: 'playeras', precio: 250, img: img('1633966887768-64f9a867bdba'), alt: 'Playera verde sobre piso de concreto' },
        { id: 'gorra-blanca', nombre: 'Gorra Blanca', categoria: 'gorras', precio: 200, img: img('1588850561407-ed78c282e89b'), alt: 'Gorra blanca sobre fondo blanco' },
        { id: 'gorra-azul', nombre: 'Gorra Azul', categoria: 'gorras', precio: 200, img: img('1517941823-815bea90d291'), alt: 'Gorra azul' },
        { id: 'gorra-amarilla', nombre: 'Gorra Amarilla', categoria: 'gorras', precio: 200, img: img('1645266729222-17cd32e06fd0'), alt: 'Gorra amarilla sobre fondo blanco' }
    ];

    const TALLAS = {
        playeras: ['CH', 'M', 'G', 'XG'],
        gorras: ['Unitalla']
    };

    /* Códigos de descuento disponibles (solo uno a la vez) */
    const CUPONES = {
        BIENVENIDO10: { tipo: 'porcentaje', valor: 10, texto: '10% de descuento en todo' },
        GORRAS20: { tipo: 'porcentaje', valor: 20, categoria: 'gorras', texto: '20% de descuento en gorras' },
        PUEBLA50: { tipo: 'fijo', valor: 50, minimo: 500, texto: '$50 de descuento en compras desde $500' },
        ENVIOGRATIS: { tipo: 'envio', texto: 'Envío gratis a domicilio' }
    };

    const COSTO_ENVIO = 99;
    const ENVIO_GRATIS_DESDE = 800;
    const MAX_CANTIDAD = 10;
    const KEY_CARRITO = 'pyg-carrito';
    const KEY_CUPON = 'pyg-cupon';
    const TARJETA_RECHAZADA = '4000000000000002';

    /* ---------- Utilidades ---------- */
    const formato = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
    const dinero = (n) => formato.format(n);
    const porId = (id) => PRODUCTOS.find((p) => p.id === id);
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
    const limitar = (n) => Math.min(MAX_CANTIDAD, Math.max(1, Number.isFinite(n) ? n : 1));
    const textoTalla = (t) => (t === 'Unitalla' ? 'Unitalla' : `Talla ${t}`);
    const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
    const escapar = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    /* ---------- Almacenamiento (con respaldo si el navegador lo bloquea) ---------- */
    const respaldo = {};

    function leerDato(key, defecto) {
        try {
            const raw = localStorage.getItem(key);
            return raw === null ? defecto : JSON.parse(raw);
        } catch (e) {
            return key in respaldo ? respaldo[key] : defecto;
        }
    }

    function guardarDato(key, valor) {
        respaldo[key] = valor;
        try {
            if (valor === null) localStorage.removeItem(key);
            else localStorage.setItem(key, JSON.stringify(valor));
        } catch (e) { /* sin almacenamiento: se usa el respaldo en memoria */ }
    }

    /* ---------- Carrito ---------- */
    function leerCarrito() {
        const datos = leerDato(KEY_CARRITO, []);
        if (!Array.isArray(datos)) return [];
        return datos
            .filter((l) => l && porId(l.id) && TALLAS[porId(l.id).categoria].includes(l.talla))
            .map((l) => ({ id: l.id, talla: l.talla, cantidad: limitar(parseInt(l.cantidad, 10)) }));
    }

    function guardarCarrito(carrito) {
        guardarDato(KEY_CARRITO, carrito);
        document.dispatchEvent(new CustomEvent('carrito:cambio'));
    }

    function agregar(id, talla, cantidad) {
        const carrito = leerCarrito();
        const linea = carrito.find((l) => l.id === id && l.talla === talla);
        let agregado = cantidad;
        if (linea) {
            const nueva = Math.min(MAX_CANTIDAD, linea.cantidad + cantidad);
            agregado = nueva - linea.cantidad;
            linea.cantidad = nueva;
        } else {
            carrito.push({ id, talla, cantidad: limitar(cantidad) });
        }
        guardarCarrito(carrito);
        return agregado;
    }

    function cambiarCantidad(id, talla, delta) {
        let carrito = leerCarrito();
        const linea = carrito.find((l) => l.id === id && l.talla === talla);
        if (!linea) return;
        linea.cantidad += delta;
        if (linea.cantidad < 1) carrito = carrito.filter((l) => l !== linea);
        else linea.cantidad = Math.min(MAX_CANTIDAD, linea.cantidad);
        guardarCarrito(carrito);
    }

    function quitar(id, talla) {
        guardarCarrito(leerCarrito().filter((l) => !(l.id === id && l.talla === talla)));
    }

    function lineas() {
        return leerCarrito().map((l) => {
            const producto = porId(l.id);
            return { ...l, producto, total: producto.precio * l.cantidad };
        });
    }

    const contar = (ls) => ls.reduce((s, l) => s + l.cantidad, 0);
    const sumar = (ls) => ls.reduce((s, l) => s + l.total, 0);

    /* ---------- Descuentos y totales ---------- */
    function evaluarCupon(codigo, ls) {
        const cupon = CUPONES[codigo];
        if (!cupon) return { ok: false, descuento: 0, mensaje: 'Ese código no existe.' };
        const subtotal = sumar(ls);

        if (cupon.tipo === 'porcentaje') {
            const base = cupon.categoria
                ? sumar(ls.filter((l) => l.producto.categoria === cupon.categoria))
                : subtotal;
            if (base === 0) return { ok: false, descuento: 0, mensaje: `Solo aplica a ${cupon.categoria}. Agrega alguna para usarlo.` };
            return { ok: true, descuento: Math.round(base * cupon.valor) / 100, mensaje: cupon.texto };
        }

        if (cupon.tipo === 'fijo') {
            if (subtotal < cupon.minimo) {
                return { ok: false, descuento: 0, mensaje: `Te faltan ${dinero(cupon.minimo - subtotal)} para usarlo.` };
            }
            return { ok: true, descuento: Math.min(cupon.valor, subtotal), mensaje: cupon.texto };
        }

        return { ok: true, descuento: 0, envioGratis: true, mensaje: cupon.texto };
    }

    function calcular(ls, codigo, entrega) {
        const subtotal = sumar(ls);
        const cupon = codigo ? evaluarCupon(codigo, ls) : null;
        const descuento = cupon && cupon.ok ? cupon.descuento : 0;
        let envio = 0;
        if (entrega === 'domicilio') {
            const gratis = (cupon && cupon.ok && cupon.envioGratis) || subtotal - descuento >= ENVIO_GRATIS_DESDE;
            envio = gratis ? 0 : COSTO_ENVIO;
        }
        return { subtotal, descuento, envio, total: subtotal - descuento + envio, cupon };
    }

    /* ---------- Catálogo en pantalla ---------- */
    function tarjeta(p) {
        const tallas = TALLAS[p.categoria];
        const selector = tallas.length > 1
            ? `<fieldset class="sizes">
                   <legend class="sr-only">Talla</legend>
                   ${tallas.map((t, i) => `
                   <label class="size">
                       <input type="radio" name="talla" value="${t}" ${i === 1 ? 'checked' : ''}>
                       <span>${t}</span>
                   </label>`).join('')}
               </fieldset>`
            : `<input type="hidden" name="talla" value="${tallas[0]}">
               <p class="size-note">${tallas[0]} · ajustable</p>`;

        return `
            <article class="product">
                <div class="product-img">
                    <img src="${p.img}" alt="${p.alt}" width="800" height="800" loading="lazy">
                </div>
                <div class="product-info">
                    <h3>${p.nombre}</h3>
                    <p class="price">${dinero(p.precio)}</p>
                </div>
                <form class="product-form" data-id="${p.id}">
                    ${selector}
                    <div class="buy-row">
                        <div class="qty">
                            <button type="button" class="qty-btn" data-step="-1" aria-label="Uno menos">−</button>
                            <input type="number" name="cantidad" value="1" min="1" max="${MAX_CANTIDAD}" inputmode="numeric" aria-label="Cantidad de ${p.nombre}">
                            <button type="button" class="qty-btn" data-step="1" aria-label="Uno más">+</button>
                        </div>
                        <button type="submit" class="btn btn-solid btn-add">Agregar</button>
                    </div>
                </form>
            </article>`;
    }

    function renderProductos() {
        $$('[data-categoria]').forEach((contenedor) => {
            const cat = contenedor.dataset.categoria;
            contenedor.innerHTML = PRODUCTOS.filter((p) => p.categoria === cat).map(tarjeta).join('');
        });
    }

    /* ---------- Carrito lateral ---------- */
    function montarCarrito() {
        if ($('#carrito')) return;
        document.body.insertAdjacentHTML('beforeend', `
            <div class="overlay" data-close-cart></div>
            <aside class="drawer" id="carrito" role="dialog" aria-modal="true" aria-labelledby="carrito-titulo" tabindex="-1" inert>
                <div class="drawer-head">
                    <h2 id="carrito-titulo">Tu carrito</h2>
                    <button type="button" class="icon-btn" data-close-cart aria-label="Cerrar carrito">×</button>
                </div>
                <div class="drawer-body" id="carrito-items"></div>
                <div class="drawer-foot" id="carrito-pie"></div>
            </aside>
            <div class="toast" id="aviso" role="status" aria-live="polite"></div>`);
    }

    function lineaCarrito(l) {
        const p = l.producto;
        const attrs = `data-line data-id="${l.id}" data-talla="${l.talla}"`;
        return `
            <li class="line">
                <img src="${p.img}" alt="" width="72" height="72">
                <div class="line-info">
                    <p class="line-name">${p.nombre}</p>
                    <p class="line-meta">${textoTalla(l.talla)} · ${dinero(p.precio)}</p>
                    <div class="qty qty-sm">
                        <button type="button" class="qty-btn" ${attrs} data-accion="menos" aria-label="Uno menos de ${p.nombre}">−</button>
                        <span class="qty-value">${l.cantidad}</span>
                        <button type="button" class="qty-btn" ${attrs} data-accion="mas" aria-label="Uno más de ${p.nombre}" ${l.cantidad >= MAX_CANTIDAD ? 'disabled' : ''}>+</button>
                    </div>
                </div>
                <div class="line-end">
                    <strong>${dinero(l.total)}</strong>
                    <button type="button" class="link-btn" ${attrs} data-accion="quitar">Quitar</button>
                </div>
            </li>`;
    }

    function renderCarrito() {
        const cuerpo = $('#carrito-items');
        const pie = $('#carrito-pie');
        if (!cuerpo) return;
        const ls = lineas();
        $('#carrito-titulo').textContent = ls.length ? `Tu carrito (${contar(ls)})` : 'Tu carrito';

        if (!ls.length) {
            cuerpo.innerHTML = `
                <div class="empty">
                    <p>Tu carrito está vacío.</p>
                    <a class="btn" href="index.html#playeras" data-close-cart>Ver productos</a>
                </div>`;
            pie.innerHTML = '';
            pie.hidden = true;
            return;
        }

        const subtotal = sumar(ls);
        const falta = ENVIO_GRATIS_DESDE - subtotal;
        const avance = Math.min(100, (subtotal / ENVIO_GRATIS_DESDE) * 100);
        const enPago = Boolean($('#checkout'));

        cuerpo.innerHTML = `<ul class="lines">${ls.map(lineaCarrito).join('')}</ul>`;
        pie.hidden = false;
        pie.innerHTML = `
            <div class="ship">
                <p>${falta > 0 ? `Te faltan <strong>${dinero(falta)}</strong> para envío gratis` : '¡Ya tienes <strong>envío gratis</strong>!'}</p>
                <div class="bar" aria-hidden="true"><span style="width:${avance}%"></span></div>
            </div>
            <div class="sum-row sum-total"><span>Subtotal</span><strong>${dinero(subtotal)}</strong></div>
            <p class="note">Los códigos de descuento y el envío se aplican al pagar.</p>
            ${enPago
                ? '<button type="button" class="btn btn-solid btn-block" data-close-cart>Continuar con el pago</button>'
                : '<a class="btn btn-solid btn-block" href="checkout.html">Ir a pagar</a>'}`;
    }

    let focoPrevio = null;

    function abrirCarrito() {
        const drawer = $('#carrito');
        focoPrevio = document.activeElement;
        renderCarrito();
        drawer.inert = false;
        document.body.classList.add('cart-open');
        drawer.focus();
    }

    function cerrarCarrito() {
        if (!document.body.classList.contains('cart-open')) return;
        document.body.classList.remove('cart-open');
        $('#carrito').inert = true;
        if (focoPrevio && document.contains(focoPrevio)) focoPrevio.focus();
    }

    function actualizarContador() {
        const n = contar(lineas());
        $$('.cart-count').forEach((el) => {
            el.textContent = n;
            el.hidden = n === 0;
        });
        $$('[data-open-cart]').forEach((b) => {
            if (b.classList.contains('cart-btn')) b.setAttribute('aria-label', `Abrir carrito, ${plural(n, 'artículo', 'artículos')}`);
        });
    }

    function animarContador() {
        $$('.cart-btn').forEach((b) => {
            b.classList.remove('bump');
            void b.offsetWidth;
            b.classList.add('bump');
        });
    }

    /* ---------- Avisos ---------- */
    let avisoTimer;

    function aviso(texto, conBoton) {
        const el = $('#aviso');
        if (!el) return;
        el.innerHTML = `<span>${texto}</span>${conBoton ? '<button type="button" data-open-cart>Ver carrito</button>' : ''}`;
        el.classList.add('is-visible');
        clearTimeout(avisoTimer);
        avisoTimer = setTimeout(() => el.classList.remove('is-visible'), 3500);
    }

    /* ---------- Eventos generales ---------- */
    document.addEventListener('click', (e) => {
        const t = e.target.closest('button, a, [data-close-cart]');
        if (!t) return;

        if (t.matches('[data-open-cart]')) {
            e.preventDefault();
            $('#aviso') && $('#aviso').classList.remove('is-visible');
            abrirCarrito();
            return;
        }

        if (t.matches('[data-close-cart]')) {
            cerrarCarrito();
            return;
        }

        if (t.matches('[data-step]')) {
            const input = t.parentElement.querySelector('input');
            input.value = limitar((parseInt(input.value, 10) || 1) + Number(t.dataset.step));
            return;
        }

        if (t.matches('[data-line]')) {
            const { id, talla, accion } = t.dataset;
            if (accion === 'mas') cambiarCantidad(id, talla, 1);
            if (accion === 'menos') cambiarCantidad(id, talla, -1);
            if (accion === 'quitar') quitar(id, talla);
            const mismo = $(`#carrito [data-id="${id}"][data-talla="${talla}"][data-accion="${accion}"]`);
            if (mismo && !mismo.disabled) mismo.focus();
            else $('#carrito').focus();
        }
    });

    document.addEventListener('change', (e) => {
        if (e.target.matches('.product-form [name="cantidad"]')) {
            e.target.value = limitar(parseInt(e.target.value, 10));
        }
    });

    document.addEventListener('submit', (e) => {
        const form = e.target.closest('.product-form');
        if (!form) return;
        e.preventDefault();
        const datos = new FormData(form);
        const producto = porId(form.dataset.id);
        const talla = datos.get('talla');
        const cantidad = limitar(parseInt(datos.get('cantidad'), 10));
        const agregado = agregar(producto.id, talla, cantidad);
        const detalle = talla === 'Unitalla' ? producto.nombre : `${producto.nombre} (${talla})`;

        if (agregado === 0) {
            aviso(`Ya tienes el máximo de ${MAX_CANTIDAD} piezas de ${detalle}.`, true);
        } else if (agregado < cantidad) {
            aviso(`Solo se agregaron ${agregado}: el máximo es ${MAX_CANTIDAD} por producto.`, true);
        } else {
            aviso(`Agregaste ${agregado} × ${detalle}`, true);
        }
        form.elements.cantidad.value = 1;
        animarContador();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') cerrarCarrito();
    });

    document.addEventListener('carrito:cambio', () => {
        actualizarContador();
        renderCarrito();
    });

    window.addEventListener('storage', (e) => {
        if (e.key === KEY_CARRITO || e.key === KEY_CUPON) document.dispatchEvent(new CustomEvent('carrito:cambio'));
    });

    /* ---------- Pago ---------- */
    function luhn(num) {
        if (!/^\d{13,19}$/.test(num)) return false;
        let suma = 0;
        let doble = false;
        for (let i = num.length - 1; i >= 0; i--) {
            let d = Number(num[i]);
            if (doble) {
                d *= 2;
                if (d > 9) d -= 9;
            }
            suma += d;
            doble = !doble;
        }
        return suma % 10 === 0;
    }

    function vigente(valor) {
        const m = /^(\d{2})\/(\d{2})$/.exec(valor);
        if (!m) return false;
        const mes = Number(m[1]);
        const anio = 2000 + Number(m[2]);
        if (mes < 1 || mes > 12) return false;
        const hoy = new Date();
        return anio > hoy.getFullYear() || (anio === hoy.getFullYear() && mes >= hoy.getMonth() + 1);
    }

    const REGLAS = {
        nombre: (v) => v.trim().length >= 3 || 'Escribe tu nombre completo.',
        email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Escribe un correo válido.',
        telefono: (v) => v.replace(/\D/g, '').length === 10 || 'El teléfono debe tener 10 dígitos.',
        calle: (v) => v.trim().length >= 5 || 'Escribe calle y número.',
        colonia: (v) => v.trim().length >= 3 || 'Escribe tu colonia.',
        cp: (v) => /^\d{5}$/.test(v) || 'El código postal tiene 5 dígitos.',
        ciudad: (v) => v.trim().length >= 3 || 'Escribe tu ciudad.',
        titular: (v) => v.trim().length >= 3 || 'Escribe el nombre como aparece en la tarjeta.',
        tarjeta: (v) => luhn(v.replace(/\D/g, '')) || 'Número de tarjeta no válido.',
        vencimiento: (v) => vigente(v) || 'Fecha no válida o vencida (MM/AA).',
        cvv: (v) => /^\d{3,4}$/.test(v) || 'El CVV tiene 3 o 4 dígitos.'
    };

    function iniciarCheckout() {
        const raiz = $('#checkout');
        if (!raiz) return;

        const form = $('#checkout-form');
        const cuponForm = $('#coupon-form');
        const vacio = $('#checkout-empty');
        const hecho = $('#checkout-done');
        let cupon = leerDato(KEY_CUPON, null);
        if (cupon && !CUPONES[cupon]) cupon = null;
        let errorCupon = '';
        let terminado = false;

        const valorDe = (nombre, defecto) => (form.querySelector(`[name="${nombre}"]:checked`) || {}).value || defecto;
        const entrega = () => valorDe('entrega', 'domicilio');
        const pago = () => valorDe('pago', 'tarjeta');

        function mostrarError(campo, mensaje) {
            const err = $(`#err-${campo.name}`);
            if (mensaje) {
                campo.setAttribute('aria-invalid', 'true');
                if (err) err.textContent = mensaje;
            } else {
                campo.removeAttribute('aria-invalid');
                if (err) err.textContent = '';
            }
        }

        function validarCampo(campo) {
            const regla = REGLAS[campo.name];
            if (!regla || campo.closest('[hidden]')) {
                mostrarError(campo, '');
                return true;
            }
            const res = regla(campo.value);
            mostrarError(campo, res === true ? '' : res);
            return res === true;
        }

        function validar() {
            let primero = null;
            Object.keys(REGLAS).forEach((nombre) => {
                const campo = form.elements[nombre];
                if (campo && !validarCampo(campo) && !primero) primero = campo;
            });
            if (primero) primero.focus();
            return !primero;
        }

        function render() {
            if (terminado) return;
            const ls = lineas();
            raiz.hidden = !ls.length;
            vacio.hidden = Boolean(ls.length);
            if (!ls.length) return;

            /* Entrega y pago */
            const esDomicilio = entrega() === 'domicilio';
            $('#direccion').hidden = !esDomicilio;
            const efectivo = form.querySelector('[name="pago"][value="efectivo"]');
            efectivo.disabled = esDomicilio;
            efectivo.closest('.option').classList.toggle('is-disabled', esDomicilio);
            if (esDomicilio && efectivo.checked) form.querySelector('[name="pago"][value="tarjeta"]').checked = true;
            $('#datos-tarjeta').hidden = pago() !== 'tarjeta';
            $('#info-transferencia').hidden = pago() !== 'transferencia';
            $('#info-efectivo').hidden = pago() !== 'efectivo';

            /* Resumen */
            $('#summary-items').innerHTML = ls.map((l) => `
                <li class="sum-item">
                    <div class="sum-thumb">
                        <img src="${l.producto.img}" alt="" width="56" height="56">
                        <span>${l.cantidad}</span>
                    </div>
                    <div class="sum-name">
                        <p>${l.producto.nombre}</p>
                        <p class="muted">${textoTalla(l.talla)}</p>
                    </div>
                    <strong>${dinero(l.total)}</strong>
                </li>`).join('');

            const r = calcular(ls, cupon, entrega());
            const estado = $('#coupon-status');
            if (cupon) {
                estado.className = `coupon-status ${r.cupon.ok ? 'is-ok' : 'is-warn'}`;
                estado.innerHTML = `
                    <span class="tag">${cupon}</span>
                    <span>${r.cupon.mensaje}</span>
                    <button type="button" class="link-btn" id="quitar-cupon">Quitar</button>`;
            } else {
                estado.className = 'coupon-status is-error';
                estado.textContent = errorCupon;
            }

            $('#sum-count').textContent = plural(contar(ls), 'artículo', 'artículos');
            $('#sum-subtotal').textContent = dinero(r.subtotal);
            $('#row-descuento').hidden = !r.descuento;
            $('#sum-descuento').textContent = `−${dinero(r.descuento)}`;
            $('#sum-envio').textContent = !esDomicilio ? 'Gratis (en tienda)' : r.envio === 0 ? 'Gratis' : dinero(r.envio);
            $('#sum-total').textContent = dinero(r.total);
            if (!$('#pay-btn').disabled) $('#pay-label').textContent = `Pagar ${dinero(r.total)}`;
        }

        /* Formato automático mientras se escribe */
        const formatos = {
            tarjeta: (v) => v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 '),
            vencimiento: (v) => {
                const d = v.replace(/\D/g, '').slice(0, 4);
                return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
            },
            cvv: (v) => v.replace(/\D/g, '').slice(0, 4),
            telefono: (v) => v.replace(/\D/g, '').slice(0, 10),
            cp: (v) => v.replace(/\D/g, '').slice(0, 5)
        };

        form.addEventListener('input', (e) => {
            const campo = e.target;
            if (formatos[campo.name]) campo.value = formatos[campo.name](campo.value);
            if (campo.getAttribute('aria-invalid') === 'true') validarCampo(campo);
        });

        form.addEventListener('focusout', (e) => {
            const campo = e.target;
            if (REGLAS[campo.name] && campo.value) validarCampo(campo);
        });

        form.addEventListener('change', (e) => {
            if (e.target.name === 'entrega' || e.target.name === 'pago') render();
        });

        cuponForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = cuponForm.elements.cupon;
            const codigo = input.value.trim().toUpperCase().replace(/\s+/g, '');
            if (!codigo) {
                errorCupon = 'Escribe un código.';
            } else if (!CUPONES[codigo]) {
                errorCupon = `“${codigo}” no es un código válido.`;
            } else {
                const antes = cupon;
                cupon = codigo;
                errorCupon = '';
                guardarDato(KEY_CUPON, codigo);
                input.value = '';
                const r = evaluarCupon(codigo, lineas());
                aviso(r.ok
                    ? `Código ${codigo} aplicado${antes && antes !== codigo ? ` (reemplazó a ${antes})` : ''}`
                    : `Código ${codigo} guardado: ${r.mensaje}`);
            }
            render();
        });

        raiz.addEventListener('click', (e) => {
            if (e.target.closest('#quitar-cupon')) {
                cupon = null;
                guardarDato(KEY_CUPON, null);
                render();
                cuponForm.elements.cupon.focus();
            }
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!validar()) {
                aviso('Revisa los campos marcados en rojo.');
                return;
            }
            const ls = lineas();
            if (!ls.length) return;

            const boton = $('#pay-btn');
            boton.disabled = true;
            boton.classList.add('is-loading');
            $('#pay-label').textContent = 'Procesando pago…';

            setTimeout(() => {
                boton.disabled = false;
                boton.classList.remove('is-loading');

                const numero = form.elements.tarjeta.value.replace(/\D/g, '');
                if (pago() === 'tarjeta' && numero === TARJETA_RECHAZADA) {
                    render();
                    mostrarError(form.elements.tarjeta, 'El banco rechazó la tarjeta. Prueba con otra.');
                    form.elements.tarjeta.focus();
                    aviso('Pago rechazado (simulación).');
                    return;
                }
                confirmar(ls, calcular(ls, cupon, entrega()), numero);
            }, 1500);
        });

        function confirmar(ls, r, numeroTarjeta) {
            terminado = true;
            const datos = Object.fromEntries(new FormData(form));
            const folio = `PYG-${String(Math.floor(100000 + Math.random() * 900000))}`;
            const esDomicilio = entrega() === 'domicilio';

            const textoEntrega = esDomicilio
                ? `Llega en 3 a 5 días hábiles a ${escapar(datos.calle)}, ${escapar(datos.colonia)}, CP ${escapar(datos.cp)}, ${escapar(datos.ciudad)}.`
                : 'Estará listo para recoger mañana en Av. 4 Pte. 1919, San Matías, Puebla.';

            const textoPago = {
                tarjeta: `Pago aprobado con tarjeta terminación ${numeroTarjeta.slice(-4)}.`,
                transferencia: `Te enviamos los datos de transferencia a ${escapar(datos.email)}. Apartamos tu pedido 48 horas.`,
                efectivo: 'Pagas en efectivo al recoger tu pedido.'
            }[pago()];

            hecho.innerHTML = `
                <div class="done-card">
                    <div class="done-icon" aria-hidden="true">✓</div>
                    <p class="eyebrow">Pedido ${folio}</p>
                    <h1 tabindex="-1">¡Gracias, ${escapar(datos.nombre.trim().split(/\s+/)[0])}!</h1>
                    <p class="done-lead">Tu pedido quedó registrado. Enviamos la confirmación a <strong>${escapar(datos.email)}</strong>.</p>

                    <ul class="summary-items">
                        ${ls.map((l) => `
                        <li class="sum-item">
                            <div class="sum-thumb"><img src="${l.producto.img}" alt="" width="56" height="56"><span>${l.cantidad}</span></div>
                            <div class="sum-name"><p>${l.producto.nombre}</p><p class="muted">${textoTalla(l.talla)}</p></div>
                            <strong>${dinero(l.total)}</strong>
                        </li>`).join('')}
                    </ul>

                    <div class="sum-rows">
                        <div class="sum-row"><span>Subtotal</span><span>${dinero(r.subtotal)}</span></div>
                        ${r.descuento ? `<div class="sum-row discount"><span>Descuento (${cupon})</span><span>−${dinero(r.descuento)}</span></div>` : ''}
                        <div class="sum-row"><span>Envío</span><span>${r.envio ? dinero(r.envio) : 'Gratis'}</span></div>
                        <div class="sum-row sum-total"><span>Total</span><strong>${dinero(r.total)}</strong></div>
                    </div>

                    <dl class="done-info">
                        <dt>Entrega</dt><dd>${textoEntrega}</dd>
                        <dt>Pago</dt><dd>${textoPago}</dd>
                    </dl>

                    <p class="sim-note">Esto es una simulación: no se realizó ningún cargo ni se enviará ningún correo.</p>
                    <a class="btn btn-solid" href="index.html">Seguir comprando</a>
                </div>`;

            guardarDato(KEY_CUPON, null);
            raiz.hidden = true;
            vacio.hidden = true;
            hecho.hidden = false;
            guardarCarrito([]);
            window.scrollTo({ top: 0 });
            $('h1', hecho).focus();
        }

        document.addEventListener('carrito:cambio', render);
        render();
    }

    /* ---------- Inicio ---------- */
    function iniciar() {
        montarCarrito();
        renderProductos();
        actualizarContador();
        renderCarrito();
        iniciarCheckout();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
})();
