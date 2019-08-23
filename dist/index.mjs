function noop() { }
const identity = x => x;
function assign(tar, src) {
    // @ts-ignore
    for (const k in src)
        tar[k] = src[k];
    return tar;
}
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}

const is_client = typeof window !== 'undefined';
let now = is_client
    ? () => window.performance.now()
    : () => Date.now();
let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

const tasks = new Set();
let running = false;
function run_tasks() {
    tasks.forEach(task => {
        if (!task[0](now())) {
            tasks.delete(task);
            task[1]();
        }
    });
    running = tasks.size > 0;
    if (running)
        raf(run_tasks);
}
function loop(fn) {
    let task;
    if (!running) {
        running = true;
        raf(run_tasks);
    }
    return {
        promise: new Promise(fulfil => {
            tasks.add(task = [fn, fulfil]);
        }),
        abort() {
            tasks.delete(task);
        }
    };
}

function append(target, node) {
    target.appendChild(node);
}
function insert(target, node, anchor) {
    target.insertBefore(node, anchor || null);
}
function detach(node) {
    node.parentNode.removeChild(node);
}
function destroy_each(iterations, detaching) {
    for (let i = 0; i < iterations.length; i += 1) {
        if (iterations[i])
            iterations[i].d(detaching);
    }
}
function element(name) {
    return document.createElement(name);
}
function svg_element(name) {
    return document.createElementNS('http://www.w3.org/2000/svg', name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function empty() {
    return text('');
}
function listen(node, event, handler, options) {
    node.addEventListener(event, handler, options);
    return () => node.removeEventListener(event, handler, options);
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else
        node.setAttribute(attribute, value);
}
function children(element) {
    return Array.from(element.childNodes);
}
function set_data(text, data) {
    data = '' + data;
    if (text.data !== data)
        text.data = data;
}
function set_style(node, key, value) {
    node.style.setProperty(key, value);
}
function toggle_class(element, name, toggle) {
    element.classList[toggle ? 'add' : 'remove'](name);
}
function custom_event(type, detail) {
    const e = document.createEvent('CustomEvent');
    e.initCustomEvent(type, false, false, detail);
    return e;
}

let stylesheet;
let active = 0;
let current_rules = {};
// https://github.com/darkskyapp/string-hash/blob/master/index.js
function hash(str) {
    let hash = 5381;
    let i = str.length;
    while (i--)
        hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
    return hash >>> 0;
}
function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
    const step = 16.666 / duration;
    let keyframes = '{\n';
    for (let p = 0; p <= 1; p += step) {
        const t = a + (b - a) * ease(p);
        keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
    }
    const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
    const name = `__svelte_${hash(rule)}_${uid}`;
    if (!current_rules[name]) {
        if (!stylesheet) {
            const style = element('style');
            document.head.appendChild(style);
            stylesheet = style.sheet;
        }
        current_rules[name] = true;
        stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
    }
    const animation = node.style.animation || '';
    node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
    active += 1;
    return name;
}
function delete_rule(node, name) {
    node.style.animation = (node.style.animation || '')
        .split(', ')
        .filter(name
        ? anim => anim.indexOf(name) < 0 // remove specific animation
        : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
    )
        .join(', ');
    if (name && !--active)
        clear_rules();
}
function clear_rules() {
    raf(() => {
        if (active)
            return;
        let i = stylesheet.cssRules.length;
        while (i--)
            stylesheet.deleteRule(i);
        current_rules = {};
    });
}

let current_component;
function set_current_component(component) {
    current_component = component;
}
function get_current_component() {
    if (!current_component)
        throw new Error(`Function called outside component initialization`);
    return current_component;
}
function onMount(fn) {
    get_current_component().$$.on_mount.push(fn);
}
function createEventDispatcher() {
    const component = current_component;
    return (type, detail) => {
        const callbacks = component.$$.callbacks[type];
        if (callbacks) {
            // TODO are there situations where events could be dispatched
            // in a server (non-DOM) environment?
            const event = custom_event(type, detail);
            callbacks.slice().forEach(fn => {
                fn.call(component, event);
            });
        }
    };
}

const dirty_components = [];
const binding_callbacks = [];
const render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
function add_flush_callback(fn) {
    flush_callbacks.push(fn);
}
function flush() {
    const seen_callbacks = new Set();
    do {
        // first, call beforeUpdate functions
        // and update components
        while (dirty_components.length) {
            const component = dirty_components.shift();
            set_current_component(component);
            update(component.$$);
        }
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                callback();
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
}
function update($$) {
    if ($$.fragment) {
        $$.update($$.dirty);
        run_all($$.before_update);
        $$.fragment.p($$.dirty, $$.ctx);
        $$.dirty = null;
        $$.after_update.forEach(add_render_callback);
    }
}

let promise;
function wait() {
    if (!promise) {
        promise = Promise.resolve();
        promise.then(() => {
            promise = null;
        });
    }
    return promise;
}
function dispatch(node, direction, kind) {
    node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
}
const outroing = new Set();
let outros;
function group_outros() {
    outros = {
        r: 0,
        c: [],
        p: outros // parent group
    };
}
function check_outros() {
    if (!outros.r) {
        run_all(outros.c);
    }
    outros = outros.p;
}
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function transition_out(block, local, detach, callback) {
    if (block && block.o) {
        if (outroing.has(block))
            return;
        outroing.add(block);
        outros.c.push(() => {
            outroing.delete(block);
            if (callback) {
                if (detach)
                    block.d(1);
                callback();
            }
        });
        block.o(local);
    }
}
const null_transition = { duration: 0 };
function create_bidirectional_transition(node, fn, params, intro) {
    let config = fn(node, params);
    let t = intro ? 0 : 1;
    let running_program = null;
    let pending_program = null;
    let animation_name = null;
    function clear_animation() {
        if (animation_name)
            delete_rule(node, animation_name);
    }
    function init(program, duration) {
        const d = program.b - t;
        duration *= Math.abs(d);
        return {
            a: t,
            b: program.b,
            d,
            duration,
            start: program.start,
            end: program.start + duration,
            group: program.group
        };
    }
    function go(b) {
        const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
        const program = {
            start: now() + delay,
            b
        };
        if (!b) {
            // @ts-ignore todo: improve typings
            program.group = outros;
            outros.r += 1;
        }
        if (running_program) {
            pending_program = program;
        }
        else {
            // if this is an intro, and there's a delay, we need to do
            // an initial tick and/or apply CSS animation immediately
            if (css) {
                clear_animation();
                animation_name = create_rule(node, t, b, duration, delay, easing, css);
            }
            if (b)
                tick(0, 1);
            running_program = init(program, duration);
            add_render_callback(() => dispatch(node, b, 'start'));
            loop(now => {
                if (pending_program && now > pending_program.start) {
                    running_program = init(pending_program, duration);
                    pending_program = null;
                    dispatch(node, running_program.b, 'start');
                    if (css) {
                        clear_animation();
                        animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                    }
                }
                if (running_program) {
                    if (now >= running_program.end) {
                        tick(t = running_program.b, 1 - t);
                        dispatch(node, running_program.b, 'end');
                        if (!pending_program) {
                            // we're done
                            if (running_program.b) {
                                // intro — we can tidy up immediately
                                clear_animation();
                            }
                            else {
                                // outro — needs to be coordinated
                                if (!--running_program.group.r)
                                    run_all(running_program.group.c);
                            }
                        }
                        running_program = null;
                    }
                    else if (now >= running_program.start) {
                        const p = now - running_program.start;
                        t = running_program.a + running_program.d * easing(p / running_program.duration);
                        tick(t, 1 - t);
                    }
                }
                return !!(running_program || pending_program);
            });
        }
    }
    return {
        run(b) {
            if (is_function(config)) {
                wait().then(() => {
                    // @ts-ignore
                    config = config();
                    go(b);
                });
            }
            else {
                go(b);
            }
        },
        end() {
            clear_animation();
            running_program = pending_program = null;
        }
    };
}

function get_spread_update(levels, updates) {
    const update = {};
    const to_null_out = {};
    const accounted_for = { $$scope: 1 };
    let i = levels.length;
    while (i--) {
        const o = levels[i];
        const n = updates[i];
        if (n) {
            for (const key in o) {
                if (!(key in n))
                    to_null_out[key] = 1;
            }
            for (const key in n) {
                if (!accounted_for[key]) {
                    update[key] = n[key];
                    accounted_for[key] = 1;
                }
            }
            levels[i] = n;
        }
        else {
            for (const key in o) {
                accounted_for[key] = 1;
            }
        }
    }
    for (const key in to_null_out) {
        if (!(key in update))
            update[key] = undefined;
    }
    return update;
}

function bind(component, name, callback) {
    if (component.$$.props.indexOf(name) === -1)
        return;
    component.$$.bound[name] = callback;
    callback(component.$$.ctx[name]);
}
function mount_component(component, target, anchor) {
    const { fragment, on_mount, on_destroy, after_update } = component.$$;
    fragment.m(target, anchor);
    // onMount happens before the initial afterUpdate
    add_render_callback(() => {
        const new_on_destroy = on_mount.map(run).filter(is_function);
        if (on_destroy) {
            on_destroy.push(...new_on_destroy);
        }
        else {
            // Edge case - component was destroyed immediately,
            // most likely as a result of a binding initialising
            run_all(new_on_destroy);
        }
        component.$$.on_mount = [];
    });
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    if (component.$$.fragment) {
        run_all(component.$$.on_destroy);
        component.$$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        component.$$.on_destroy = component.$$.fragment = null;
        component.$$.ctx = {};
    }
}
function make_dirty(component, key) {
    if (!component.$$.dirty) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty = blank_object();
    }
    component.$$.dirty[key] = true;
}
function init(component, options, instance, create_fragment, not_equal, prop_names) {
    const parent_component = current_component;
    set_current_component(component);
    const props = options.props || {};
    const $$ = component.$$ = {
        fragment: null,
        ctx: null,
        // state
        props: prop_names,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        before_update: [],
        after_update: [],
        context: new Map(parent_component ? parent_component.$$.context : []),
        // everything else
        callbacks: blank_object(),
        dirty: null
    };
    let ready = false;
    $$.ctx = instance
        ? instance(component, props, (key, value) => {
            if ($$.ctx && not_equal($$.ctx[key], $$.ctx[key] = value)) {
                if ($$.bound[key])
                    $$.bound[key](value);
                if (ready)
                    make_dirty(component, key);
            }
        })
        : props;
    $$.update();
    ready = true;
    run_all($$.before_update);
    $$.fragment = create_fragment($$.ctx);
    if (options.target) {
        if (options.hydrate) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment.l(children(options.target));
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor);
        flush();
    }
    set_current_component(parent_component);
}
class SvelteComponent {
    $destroy() {
        destroy_component(this, 1);
        this.$destroy = noop;
    }
    $on(type, callback) {
        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
        callbacks.push(callback);
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1)
                callbacks.splice(index, 1);
        };
    }
    $set() {
        // overridden by instance, if it has props
    }
}

function calendarWeeks (year, month) {
  const now = new Date();
  const currentMonth = now.getFullYear() === year && now.getMonth() === month;
  const weeks = [];
  const start = (new Date(year, month, 1)).getDay();
  const days = [];
  const feb = (year % 100 != 0) && (year % 4 == 0) || (year % 400 == 0) ? 29 : 28;
  const dayPerMonth = [31, feb, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const numDays = dayPerMonth[month];
  for (let i = 0; i < start; i++) {
    days.push({ valid: false });
  }
  for (let i = 1; i <= numDays; i++) {
    const dateString = year + '-' + zpad(((month) + 1), 2) + '-' + zpad(i, 2);
    const date = new Date(dateString);
    days.push({
      valid: true,
      dateString,
      date,
      day: date.getDay(),
      number: i,
      today: currentMonth && now.getDate() === i
    });
  }
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  const finalWeek = weeks[weeks.length - 1];
  const toAdd = 7 - finalWeek.length;
  for (let i = 0; i < toAdd; i++) {
    finalWeek.push({ valid: false });
  }
  return weeks
}

function zpad(number, length) {
  let str = "" + number;
  while (str.length < length) {
    str = '0' + str;
  }
  return str
}

/* node_modules/svelte-feather-icons/src/icons/ChevronLeftIcon.svelte generated by Svelte v3.8.0 */

function create_fragment(ctx) {
	var svg, polyline;

	return {
		c() {
			svg = svg_element("svg");
			polyline = svg_element("polyline");
			attr(polyline, "points", "15 18 9 12 15 6");
			attr(svg, "xmlns", "http://www.w3.org/2000/svg");
			attr(svg, "width", "100%");
			attr(svg, "height", "100%");
			attr(svg, "fill", "none");
			attr(svg, "viewBox", "0 0 24 24");
			attr(svg, "stroke", "currentColor");
			attr(svg, "stroke-width", "2");
			attr(svg, "stroke-linecap", "round");
			attr(svg, "stroke-linejoin", "round");
			attr(svg, "class", "feather feather-chevron-left");
		},

		m(target, anchor) {
			insert(target, svg, anchor);
			append(svg, polyline);
		},

		p: noop,
		i: noop,
		o: noop,

		d(detaching) {
			if (detaching) {
				detach(svg);
			}
		}
	};
}

class ChevronLeftIcon extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, null, create_fragment, safe_not_equal, []);
	}
}

/* node_modules/svelte-feather-icons/src/icons/ChevronRightIcon.svelte generated by Svelte v3.8.0 */

function create_fragment$1(ctx) {
	var svg, polyline;

	return {
		c() {
			svg = svg_element("svg");
			polyline = svg_element("polyline");
			attr(polyline, "points", "9 18 15 12 9 6");
			attr(svg, "xmlns", "http://www.w3.org/2000/svg");
			attr(svg, "width", "100%");
			attr(svg, "height", "100%");
			attr(svg, "fill", "none");
			attr(svg, "viewBox", "0 0 24 24");
			attr(svg, "stroke", "currentColor");
			attr(svg, "stroke-width", "2");
			attr(svg, "stroke-linecap", "round");
			attr(svg, "stroke-linejoin", "round");
			attr(svg, "class", "feather feather-chevron-right");
		},

		m(target, anchor) {
			insert(target, svg, anchor);
			append(svg, polyline);
		},

		p: noop,
		i: noop,
		o: noop,

		d(detaching) {
			if (detaching) {
				detach(svg);
			}
		}
	};
}

class ChevronRightIcon extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, null, create_fragment$1, safe_not_equal, []);
	}
}

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var dayjs_min = createCommonjsModule(function (module, exports) {
!function(t,n){module.exports=n();}(commonjsGlobal,function(){var t="millisecond",n="second",e="minute",r="hour",i="day",s="week",u="month",o="quarter",a="year",h=/^(\d{4})-?(\d{1,2})-?(\d{0,2})[^0-9]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?.?(\d{1,3})?$/,f=/\[([^\]]+)]|Y{2,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g,c=function(t,n,e){var r=String(t);return !r||r.length>=n?t:""+Array(n+1-r.length).join(e)+t},d={s:c,z:function(t){var n=-t.utcOffset(),e=Math.abs(n),r=Math.floor(e/60),i=e%60;return (n<=0?"+":"-")+c(r,2,"0")+":"+c(i,2,"0")},m:function(t,n){var e=12*(n.year()-t.year())+(n.month()-t.month()),r=t.clone().add(e,u),i=n-r<0,s=t.clone().add(e+(i?-1:1),u);return Number(-(e+(n-r)/(i?r-s:s-r))||0)},a:function(t){return t<0?Math.ceil(t)||0:Math.floor(t)},p:function(h){return {M:u,y:a,w:s,d:i,h:r,m:e,s:n,ms:t,Q:o}[h]||String(h||"").toLowerCase().replace(/s$/,"")},u:function(t){return void 0===t}},$={name:"en",weekdays:"Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"),months:"January_February_March_April_May_June_July_August_September_October_November_December".split("_")},l="en",m={};m[l]=$;var y=function(t){return t instanceof v},M=function(t,n,e){var r;if(!t)return l;if("string"==typeof t)m[t]&&(r=t),n&&(m[t]=n,r=t);else{var i=t.name;m[i]=t,r=i;}return e||(l=r),r},g=function(t,n,e){if(y(t))return t.clone();var r=n?"string"==typeof n?{format:n,pl:e}:n:{};return r.date=t,new v(r)},D=d;D.l=M,D.i=y,D.w=function(t,n){return g(t,{locale:n.$L,utc:n.$u})};var v=function(){function c(t){this.$L=this.$L||M(t.locale,null,!0),this.parse(t);}var d=c.prototype;return d.parse=function(t){this.$d=function(t){var n=t.date,e=t.utc;if(null===n)return new Date(NaN);if(D.u(n))return new Date;if(n instanceof Date)return new Date(n);if("string"==typeof n&&!/Z$/i.test(n)){var r=n.match(h);if(r)return e?new Date(Date.UTC(r[1],r[2]-1,r[3]||1,r[4]||0,r[5]||0,r[6]||0,r[7]||0)):new Date(r[1],r[2]-1,r[3]||1,r[4]||0,r[5]||0,r[6]||0,r[7]||0)}return new Date(n)}(t),this.init();},d.init=function(){var t=this.$d;this.$y=t.getFullYear(),this.$M=t.getMonth(),this.$D=t.getDate(),this.$W=t.getDay(),this.$H=t.getHours(),this.$m=t.getMinutes(),this.$s=t.getSeconds(),this.$ms=t.getMilliseconds();},d.$utils=function(){return D},d.isValid=function(){return !("Invalid Date"===this.$d.toString())},d.isSame=function(t,n){var e=g(t);return this.startOf(n)<=e&&e<=this.endOf(n)},d.isAfter=function(t,n){return g(t)<this.startOf(n)},d.isBefore=function(t,n){return this.endOf(n)<g(t)},d.$g=function(t,n,e){return D.u(t)?this[n]:this.set(e,t)},d.year=function(t){return this.$g(t,"$y",a)},d.month=function(t){return this.$g(t,"$M",u)},d.day=function(t){return this.$g(t,"$W",i)},d.date=function(t){return this.$g(t,"$D","date")},d.hour=function(t){return this.$g(t,"$H",r)},d.minute=function(t){return this.$g(t,"$m",e)},d.second=function(t){return this.$g(t,"$s",n)},d.millisecond=function(n){return this.$g(n,"$ms",t)},d.unix=function(){return Math.floor(this.valueOf()/1e3)},d.valueOf=function(){return this.$d.getTime()},d.startOf=function(t,o){var h=this,f=!!D.u(o)||o,c=D.p(t),d=function(t,n){var e=D.w(h.$u?Date.UTC(h.$y,n,t):new Date(h.$y,n,t),h);return f?e:e.endOf(i)},$=function(t,n){return D.w(h.toDate()[t].apply(h.toDate(),(f?[0,0,0,0]:[23,59,59,999]).slice(n)),h)},l=this.$W,m=this.$M,y=this.$D,M="set"+(this.$u?"UTC":"");switch(c){case a:return f?d(1,0):d(31,11);case u:return f?d(1,m):d(0,m+1);case s:var g=this.$locale().weekStart||0,v=(l<g?l+7:l)-g;return d(f?y-v:y+(6-v),m);case i:case"date":return $(M+"Hours",0);case r:return $(M+"Minutes",1);case e:return $(M+"Seconds",2);case n:return $(M+"Milliseconds",3);default:return this.clone()}},d.endOf=function(t){return this.startOf(t,!1)},d.$set=function(s,o){var h,f=D.p(s),c="set"+(this.$u?"UTC":""),d=(h={},h[i]=c+"Date",h.date=c+"Date",h[u]=c+"Month",h[a]=c+"FullYear",h[r]=c+"Hours",h[e]=c+"Minutes",h[n]=c+"Seconds",h[t]=c+"Milliseconds",h)[f],$=f===i?this.$D+(o-this.$W):o;if(f===u||f===a){var l=this.clone().set("date",1);l.$d[d]($),l.init(),this.$d=l.set("date",Math.min(this.$D,l.daysInMonth())).toDate();}else d&&this.$d[d]($);return this.init(),this},d.set=function(t,n){return this.clone().$set(t,n)},d.get=function(t){return this[D.p(t)]()},d.add=function(t,o){var h,f=this;t=Number(t);var c=D.p(o),d=function(n){var e=g(f);return D.w(e.date(e.date()+Math.round(n*t)),f)};if(c===u)return this.set(u,this.$M+t);if(c===a)return this.set(a,this.$y+t);if(c===i)return d(1);if(c===s)return d(7);var $=(h={},h[e]=6e4,h[r]=36e5,h[n]=1e3,h)[c]||1,l=this.valueOf()+t*$;return D.w(l,this)},d.subtract=function(t,n){return this.add(-1*t,n)},d.format=function(t){var n=this;if(!this.isValid())return "Invalid Date";var e=t||"YYYY-MM-DDTHH:mm:ssZ",r=D.z(this),i=this.$locale(),s=this.$H,u=this.$m,o=this.$M,a=i.weekdays,h=i.months,c=function(t,r,i,s){return t&&(t[r]||t(n,e))||i[r].substr(0,s)},d=function(t){return D.s(s%12||12,t,"0")},$=i.meridiem||function(t,n,e){var r=t<12?"AM":"PM";return e?r.toLowerCase():r},l={YY:String(this.$y).slice(-2),YYYY:this.$y,M:o+1,MM:D.s(o+1,2,"0"),MMM:c(i.monthsShort,o,h,3),MMMM:h[o]||h(this,e),D:this.$D,DD:D.s(this.$D,2,"0"),d:String(this.$W),dd:c(i.weekdaysMin,this.$W,a,2),ddd:c(i.weekdaysShort,this.$W,a,3),dddd:a[this.$W],H:String(s),HH:D.s(s,2,"0"),h:d(1),hh:d(2),a:$(s,u,!0),A:$(s,u,!1),m:String(u),mm:D.s(u,2,"0"),s:String(this.$s),ss:D.s(this.$s,2,"0"),SSS:D.s(this.$ms,3,"0"),Z:r};return e.replace(f,function(t,n){return n||l[t]||r.replace(":","")})},d.utcOffset=function(){return 15*-Math.round(this.$d.getTimezoneOffset()/15)},d.diff=function(t,h,f){var c,d=D.p(h),$=g(t),l=6e4*($.utcOffset()-this.utcOffset()),m=this-$,y=D.m(this,$);return y=(c={},c[a]=y/12,c[u]=y,c[o]=y/3,c[s]=(m-l)/6048e5,c[i]=(m-l)/864e5,c[r]=m/36e5,c[e]=m/6e4,c[n]=m/1e3,c)[d]||m,f?y:D.a(y)},d.daysInMonth=function(){return this.endOf(u).$D},d.$locale=function(){return m[this.$L]},d.locale=function(t,n){if(!t)return this.$L;var e=this.clone();return e.$L=M(t,n,!0),e},d.clone=function(){return D.w(this.toDate(),this)},d.toDate=function(){return new Date(this.$d)},d.toJSON=function(){return this.toISOString()},d.toISOString=function(){return this.$d.toISOString()},d.toString=function(){return this.$d.toUTCString()},c}();return g.prototype=v.prototype,g.extend=function(t,n){return t(n,v,g),g},g.locale=M,g.isDayjs=y,g.unix=function(t){return g(1e3*t)},g.en=m[l],g.Ls=m,g});
});

var justSafeGet = get;

/*
  const obj = {a: {aa: {aaa: 2}}, b: 4};

  get(obj, 'a.aa.aaa'); // 2
  get(obj, ['a', 'aa', 'aaa']); // 2

  get(obj, 'b.bb.bbb'); // undefined
  get(obj, ['b', 'bb', 'bbb']); // undefined

  get(obj.a, 'aa.aaa'); // 2
  get(obj.a, ['aa', 'aaa']); // 2

  get(obj.b, 'bb.bbb'); // undefined
  get(obj.b, ['bb', 'bbb']); // undefined

  const obj = {a: {}};
  const sym = Symbol();
  obj.a[sym] = 4;
  get(obj.a, sym); // 4
*/

function get(obj, propsArg) {
  if (!obj) {
    return obj;
  }
  var props, prop;
  if (Array.isArray(propsArg)) {
    props = propsArg.slice(0);
  }
  if (typeof propsArg == 'string') {
    props = propsArg.split('.');
  }
  if (typeof propsArg == 'symbol') {
    props = [propsArg];
  }
  if (!Array.isArray(props)) {
    throw new Error('props arg must be an array, a string or a symbol');
  }
  while (props.length) {
    prop = props.shift();
    if (!obj) {
      return void 0;
    }
    obj = obj[prop];
    if (obj === undefined) {
      return obj;
    }
  }
  return obj;
}

function fade(node, { delay = 0, duration = 400 }) {
    const o = +getComputedStyle(node).opacity;
    return {
        delay,
        duration,
        css: t => `opacity: ${t * o}`
    };
}

/* src/Scheduler.svelte generated by Svelte v3.8.0 */

function add_css() {
	var style = element("style");
	style.id = 'svelte-1v4przp-style';
	style.textContent = ".scheduler.svelte-1v4przp{width:100%}.navigation .button svg{stroke:grey;height:16px;width:16px}.month.svelte-1v4przp{display:-webkit-box;display:flex;-webkit-box-orient:vertical;-webkit-box-direction:normal;flex-direction:column}.week.svelte-1v4przp,.header.svelte-1v4przp,.navigation.svelte-1v4przp{display:-webkit-box;display:flex;-webkit-box-orient:horizontal;-webkit-box-direction:normal;flex-direction:row}.header.svelte-1v4przp{height:48px;display:-webkit-box;display:flex}.navigation.svelte-1v4przp{display:-webkit-box;display:flex;-webkit-box-orient:horizontal;-webkit-box-direction:normal;flex-direction:row;-webkit-box-pack:justify;justify-content:space-between;margin:12px 0}.navigation.svelte-1v4przp .button.svelte-1v4przp{border:0;background-color:transparent}.navigation.svelte-1v4przp .button.svelte-1v4przp,.navigation.svelte-1v4przp .current-month.svelte-1v4przp{font-size:16px;display:-webkit-box;display:flex;-webkit-box-align:center;align-items:center;font-weight:500}.day-name.svelte-1v4przp{-webkit-box-flex:1;flex:1;display:-webkit-box;display:flex;-webkit-box-align:center;align-items:center;-webkit-box-pack:center;justify-content:center;color:lightgrey;font-weight:500;border:1px solid white}.week.svelte-1v4przp{display:-webkit-box;display:flex;-webkit-box-orient:horizontal;-webkit-box-direction:normal;flex-direction:row;width:100%;-webkit-box-pack:space-evenly;justify-content:space-evenly}.day.svelte-1v4przp{position:relative;width:100%;border:1px solid transparent;display:-webkit-box;display:flex;padding:12px}.day.svelte-1v4przp::after,.day-name.svelte-1v4przp::after{content:'';display:block;padding-bottom:100%}.day.svelte-1v4przp .content.svelte-1v4przp{display:-webkit-box;display:flex;-webkit-box-flex:1;flex:1}.day.svelte-1v4przp .number.svelte-1v4przp{position:absolute;top:0;left:0;font-size:16px;color:darkgrey;margin:6px}.day.is-valid.svelte-1v4przp{border-right:1px solid lightgrey;border-bottom:1px solid lightgrey;cursor:pointer}.day.is-selected.svelte-1v4przp{background-color:aquamarine}.day.is-valid.svelte-1v4przp:first-of-type{border-left:1px solid lightgrey}.day.d-1.svelte-1v4przp,.day.d-2.svelte-1v4przp,.day.d-3.svelte-1v4przp,.day.d-4.svelte-1v4przp,.day.d-5.svelte-1v4przp,.day.d-6.svelte-1v4przp,.day.d-7.svelte-1v4przp{border-top:1px solid lightgrey}.day.d-1.svelte-1v4przp{border-left:1px solid lightgrey}";
	append(document.head, style);
}

function get_each_context_1(ctx, list, i) {
	const child_ctx = Object.create(ctx);
	child_ctx.weekday = list[i];
	child_ctx.d = i;
	return child_ctx;
}

function get_each_context(ctx, list, i) {
	const child_ctx = Object.create(ctx);
	child_ctx.week = list[i];
	return child_ctx;
}

function get_each_context_2(ctx, list, i) {
	const child_ctx = Object.create(ctx);
	child_ctx.dayName = list[i];
	return child_ctx;
}

// (16:3) {#each dayNames as dayName}
function create_each_block_2(ctx) {
	var div, t0_value = ctx.dayName + "", t0, t1;

	return {
		c() {
			div = element("div");
			t0 = text(t0_value);
			t1 = space();
			attr(div, "class", "day-name svelte-1v4przp");
		},

		m(target, anchor) {
			insert(target, div, anchor);
			append(div, t0);
			append(div, t1);
		},

		p: noop,

		d(detaching) {
			if (detaching) {
				detach(div);
			}
		}
	};
}

// (33:5) {#if weekday.valid}
function create_if_block_1(ctx) {
	var div, span, t0_value = ctx.weekday.number + "", t0, t1, if_block_anchor, current;

	var if_block = (!!justSafeGet(ctx.schedule, [ ctx.weekday.number ])) && create_if_block_2(ctx);

	return {
		c() {
			div = element("div");
			span = element("span");
			t0 = text(t0_value);
			t1 = space();
			if (if_block) if_block.c();
			if_block_anchor = empty();
			attr(div, "class", "number svelte-1v4przp");
		},

		m(target, anchor) {
			insert(target, div, anchor);
			append(div, span);
			append(span, t0);
			insert(target, t1, anchor);
			if (if_block) if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
			current = true;
		},

		p(changed, ctx) {
			if ((!current || changed.currentDate) && t0_value !== (t0_value = ctx.weekday.number + "")) {
				set_data(t0, t0_value);
			}

			if (!!justSafeGet(ctx.schedule, [ ctx.weekday.number ])) {
				if (if_block) {
					if_block.p(changed, ctx);
					transition_in(if_block, 1);
				} else {
					if_block = create_if_block_2(ctx);
					if_block.c();
					transition_in(if_block, 1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			} else if (if_block) {
				group_outros();
				transition_out(if_block, 1, 1, () => {
					if_block = null;
				});
				check_outros();
			}
		},

		i(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},

		o(local) {
			transition_out(if_block);
			current = false;
		},

		d(detaching) {
			if (detaching) {
				detach(div);
				detach(t1);
			}

			if (if_block) if_block.d(detaching);

			if (detaching) {
				detach(if_block_anchor);
			}
		}
	};
}

// (37:6) {#if !!get(schedule, [ weekday.number ])}
function create_if_block_2(ctx) {
	var switch_instance_anchor, current;

	var switch_instance_spread_levels = [
		ctx.schedule[ctx.weekday.number].props
	];

	var switch_value = ctx.schedule[ctx.weekday.number].component;

	function switch_props(ctx) {
		let switch_instance_props = {};
		for (var i = 0; i < switch_instance_spread_levels.length; i += 1) {
			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
		}
		return { props: switch_instance_props };
	}

	if (switch_value) {
		var switch_instance = new switch_value(switch_props());
	}

	return {
		c() {
			if (switch_instance) switch_instance.$$.fragment.c();
			switch_instance_anchor = empty();
		},

		m(target, anchor) {
			if (switch_instance) {
				mount_component(switch_instance, target, anchor);
			}

			insert(target, switch_instance_anchor, anchor);
			current = true;
		},

		p(changed, ctx) {
			var switch_instance_changes = (changed.schedule || changed.calendarWeeks || changed.currentDate) ? get_spread_update(switch_instance_spread_levels, [
									ctx.schedule[ctx.weekday.number].props
								]) : {};

			if (switch_value !== (switch_value = ctx.schedule[ctx.weekday.number].component)) {
				if (switch_instance) {
					group_outros();
					const old_component = switch_instance;
					transition_out(old_component.$$.fragment, 1, 0, () => {
						destroy_component(old_component, 1);
					});
					check_outros();
				}

				if (switch_value) {
					switch_instance = new switch_value(switch_props());

					switch_instance.$$.fragment.c();
					transition_in(switch_instance.$$.fragment, 1);
					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
				} else {
					switch_instance = null;
				}
			}

			else if (switch_value) {
				switch_instance.$set(switch_instance_changes);
			}
		},

		i(local) {
			if (current) return;
			if (switch_instance) transition_in(switch_instance.$$.fragment, local);

			current = true;
		},

		o(local) {
			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
			current = false;
		},

		d(detaching) {
			if (detaching) {
				detach(switch_instance_anchor);
			}

			if (switch_instance) destroy_component(switch_instance, detaching);
		}
	};
}

// (24:3) {#each week as weekday, d}
function create_each_block_1(ctx) {
	var div1, div0, div1_class_value, current, dispose;

	var if_block = (ctx.weekday.valid) && create_if_block_1(ctx);

	function click_handler(...args) {
		return ctx.click_handler(ctx, ...args);
	}

	return {
		c() {
			div1 = element("div");
			div0 = element("div");
			if (if_block) if_block.c();
			attr(div0, "class", "content svelte-1v4przp");
			attr(div1, "class", div1_class_value = "day d-" + ctx.weekday.number + " svelte-1v4przp");
			toggle_class(div1, "is-valid", ctx.weekday.valid);
			toggle_class(div1, "is-selected", ctx.selected === ctx.weekday.number);
			toggle_class(div1, "has-schedule", !!justSafeGet(ctx.schedule, [ ctx.weekday.number ]));
			dispose = listen(div1, "click", click_handler);
		},

		m(target, anchor) {
			insert(target, div1, anchor);
			append(div1, div0);
			if (if_block) if_block.m(div0, null);
			current = true;
		},

		p(changed, new_ctx) {
			ctx = new_ctx;
			if (ctx.weekday.valid) {
				if (if_block) {
					if_block.p(changed, ctx);
					transition_in(if_block, 1);
				} else {
					if_block = create_if_block_1(ctx);
					if_block.c();
					transition_in(if_block, 1);
					if_block.m(div0, null);
				}
			} else if (if_block) {
				group_outros();
				transition_out(if_block, 1, 1, () => {
					if_block = null;
				});
				check_outros();
			}

			if ((!current || changed.currentDate) && div1_class_value !== (div1_class_value = "day d-" + ctx.weekday.number + " svelte-1v4przp")) {
				attr(div1, "class", div1_class_value);
			}

			if ((changed.calendarWeeks || changed.currentDate || changed.calendarWeeks || changed.currentDate)) {
				toggle_class(div1, "is-valid", ctx.weekday.valid);
			}

			if ((changed.calendarWeeks || changed.currentDate || changed.selected || changed.calendarWeeks || changed.currentDate)) {
				toggle_class(div1, "is-selected", ctx.selected === ctx.weekday.number);
			}

			if ((changed.calendarWeeks || changed.currentDate || changed.get || changed.schedule || changed.calendarWeeks || changed.currentDate)) {
				toggle_class(div1, "has-schedule", !!justSafeGet(ctx.schedule, [ ctx.weekday.number ]));
			}
		},

		i(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},

		o(local) {
			transition_out(if_block);
			current = false;
		},

		d(detaching) {
			if (detaching) {
				detach(div1);
			}

			if (if_block) if_block.d();
			dispose();
		}
	};
}

// (22:2) {#each calendarWeeks(currentDate.year(), currentDate.month()) as week}
function create_each_block(ctx) {
	var div, t, current;

	var each_value_1 = ctx.week;

	var each_blocks = [];

	for (var i = 0; i < each_value_1.length; i += 1) {
		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	return {
		c() {
			div = element("div");

			for (var i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t = space();
			attr(div, "class", "week svelte-1v4przp");
		},

		m(target, anchor) {
			insert(target, div, anchor);

			for (var i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(div, null);
			}

			append(div, t);
			current = true;
		},

		p(changed, ctx) {
			if (changed.calendarWeeks || changed.currentDate || changed.selected || changed.get || changed.schedule) {
				each_value_1 = ctx.week;

				for (var i = 0; i < each_value_1.length; i += 1) {
					const child_ctx = get_each_context_1(ctx, each_value_1, i);

					if (each_blocks[i]) {
						each_blocks[i].p(changed, child_ctx);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block_1(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(div, t);
					}
				}

				group_outros();
				for (i = each_value_1.length; i < each_blocks.length; i += 1) out(i);
				check_outros();
			}
		},

		i(local) {
			if (current) return;
			for (var i = 0; i < each_value_1.length; i += 1) transition_in(each_blocks[i]);

			current = true;
		},

		o(local) {
			each_blocks = each_blocks.filter(Boolean);
			for (let i = 0; i < each_blocks.length; i += 1) transition_out(each_blocks[i]);

			current = false;
		},

		d(detaching) {
			if (detaching) {
				detach(div);
			}

			destroy_each(each_blocks, detaching);
		}
	};
}

// (47:2) {#if !!get(schedule, [ selected, 'popdown' ]) }
function create_if_block(ctx) {
	var div, div_transition, current;

	var switch_instance_spread_levels = [
		ctx.schedule[ctx.selected].props
	];

	var switch_value = ctx.schedule[ctx.selected].popdown;

	function switch_props(ctx) {
		let switch_instance_props = {};
		for (var i = 0; i < switch_instance_spread_levels.length; i += 1) {
			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
		}
		return { props: switch_instance_props };
	}

	if (switch_value) {
		var switch_instance = new switch_value(switch_props());
	}

	return {
		c() {
			div = element("div");
			if (switch_instance) switch_instance.$$.fragment.c();
		},

		m(target, anchor) {
			insert(target, div, anchor);

			if (switch_instance) {
				mount_component(switch_instance, div, null);
			}

			current = true;
		},

		p(changed, ctx) {
			var switch_instance_changes = (changed.schedule || changed.selected) ? get_spread_update(switch_instance_spread_levels, [
									ctx.schedule[ctx.selected].props
								]) : {};

			if (switch_value !== (switch_value = ctx.schedule[ctx.selected].popdown)) {
				if (switch_instance) {
					group_outros();
					const old_component = switch_instance;
					transition_out(old_component.$$.fragment, 1, 0, () => {
						destroy_component(old_component, 1);
					});
					check_outros();
				}

				if (switch_value) {
					switch_instance = new switch_value(switch_props());

					switch_instance.$$.fragment.c();
					transition_in(switch_instance.$$.fragment, 1);
					mount_component(switch_instance, div, null);
				} else {
					switch_instance = null;
				}
			}

			else if (switch_value) {
				switch_instance.$set(switch_instance_changes);
			}
		},

		i(local) {
			if (current) return;
			if (switch_instance) transition_in(switch_instance.$$.fragment, local);

			add_render_callback(() => {
				if (!div_transition) div_transition = create_bidirectional_transition(div, fade, {}, true);
				div_transition.run(1);
			});

			current = true;
		},

		o(local) {
			if (switch_instance) transition_out(switch_instance.$$.fragment, local);

			if (!div_transition) div_transition = create_bidirectional_transition(div, fade, {}, false);
			div_transition.run(0);

			current = false;
		},

		d(detaching) {
			if (detaching) {
				detach(div);
			}

			if (switch_instance) destroy_component(switch_instance);

			if (detaching) {
				if (div_transition) div_transition.end();
			}
		}
	};
}

function create_fragment$2(ctx) {
	var div4, div1, button0, t0, div0, t1_value = ctx.currentDate.format('MMMM') + "", t1, t2, button1, t3, div3, div2, t4, t5, current, dispose;

	var chevronlefticon = new ChevronLeftIcon({});

	var chevronrighticon = new ChevronRightIcon({});

	var each_value_2 = ctx.dayNames;

	var each_blocks_1 = [];

	for (var i = 0; i < each_value_2.length; i += 1) {
		each_blocks_1[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
	}

	var each_value = calendarWeeks(ctx.currentDate.year(), ctx.currentDate.month());

	var each_blocks = [];

	for (var i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	var if_block = (!!justSafeGet(ctx.schedule, [ ctx.selected, 'popdown' ])) && create_if_block(ctx);

	return {
		c() {
			div4 = element("div");
			div1 = element("div");
			button0 = element("button");
			chevronlefticon.$$.fragment.c();
			t0 = space();
			div0 = element("div");
			t1 = text(t1_value);
			t2 = space();
			button1 = element("button");
			chevronrighticon.$$.fragment.c();
			t3 = space();
			div3 = element("div");
			div2 = element("div");

			for (var i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].c();
			}

			t4 = space();

			for (var i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t5 = space();
			if (if_block) if_block.c();
			attr(button0, "class", "button is-medium previous svelte-1v4przp");
			attr(div0, "class", "current-month svelte-1v4przp");
			attr(button1, "class", "button is-medium next svelte-1v4przp");
			attr(div1, "class", "navigation svelte-1v4przp");
			attr(div2, "class", "header svelte-1v4przp");
			attr(div3, "class", "month svelte-1v4przp");
			attr(div4, "class", "scheduler svelte-1v4przp");

			dispose = [
				listen(button0, "click", ctx.prev),
				listen(button1, "click", ctx.next)
			];
		},

		m(target, anchor) {
			insert(target, div4, anchor);
			append(div4, div1);
			append(div1, button0);
			mount_component(chevronlefticon, button0, null);
			append(div1, t0);
			append(div1, div0);
			append(div0, t1);
			append(div1, t2);
			append(div1, button1);
			mount_component(chevronrighticon, button1, null);
			append(div4, t3);
			append(div4, div3);
			append(div3, div2);

			for (var i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].m(div2, null);
			}

			append(div3, t4);

			for (var i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(div3, null);
			}

			append(div4, t5);
			if (if_block) if_block.m(div4, null);
			current = true;
		},

		p(changed, ctx) {
			if ((!current || changed.currentDate) && t1_value !== (t1_value = ctx.currentDate.format('MMMM') + "")) {
				set_data(t1, t1_value);
			}

			if (changed.dayNames) {
				each_value_2 = ctx.dayNames;

				for (var i = 0; i < each_value_2.length; i += 1) {
					const child_ctx = get_each_context_2(ctx, each_value_2, i);

					if (each_blocks_1[i]) {
						each_blocks_1[i].p(changed, child_ctx);
					} else {
						each_blocks_1[i] = create_each_block_2(child_ctx);
						each_blocks_1[i].c();
						each_blocks_1[i].m(div2, null);
					}
				}

				for (; i < each_blocks_1.length; i += 1) {
					each_blocks_1[i].d(1);
				}
				each_blocks_1.length = each_value_2.length;
			}

			if (changed.calendarWeeks || changed.currentDate || changed.selected || changed.get || changed.schedule) {
				each_value = calendarWeeks(ctx.currentDate.year(), ctx.currentDate.month());

				for (var i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(changed, child_ctx);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(div3, null);
					}
				}

				group_outros();
				for (i = each_value.length; i < each_blocks.length; i += 1) out(i);
				check_outros();
			}

			if (!!justSafeGet(ctx.schedule, [ ctx.selected, 'popdown' ])) {
				if (if_block) {
					if_block.p(changed, ctx);
					transition_in(if_block, 1);
				} else {
					if_block = create_if_block(ctx);
					if_block.c();
					transition_in(if_block, 1);
					if_block.m(div4, null);
				}
			} else if (if_block) {
				group_outros();
				transition_out(if_block, 1, 1, () => {
					if_block = null;
				});
				check_outros();
			}
		},

		i(local) {
			if (current) return;
			transition_in(chevronlefticon.$$.fragment, local);

			transition_in(chevronrighticon.$$.fragment, local);

			for (var i = 0; i < each_value.length; i += 1) transition_in(each_blocks[i]);

			transition_in(if_block);
			current = true;
		},

		o(local) {
			transition_out(chevronlefticon.$$.fragment, local);
			transition_out(chevronrighticon.$$.fragment, local);

			each_blocks = each_blocks.filter(Boolean);
			for (let i = 0; i < each_blocks.length; i += 1) transition_out(each_blocks[i]);

			transition_out(if_block);
			current = false;
		},

		d(detaching) {
			if (detaching) {
				detach(div4);
			}

			destroy_component(chevronlefticon);

			destroy_component(chevronrighticon);

			destroy_each(each_blocks_1, detaching);

			destroy_each(each_blocks, detaching);

			if (if_block) if_block.d();
			run_all(dispose);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	
  
  const dispatch = createEventDispatcher();
  const dayNames = [0, 1, 2, 3, 4, 5, 6].map(d => dayjs_min().day(d).format('ddd'));

	let currentDate = dayjs_min();
	let schedule;
  let selected = null;
	
	onMount (async () => {
		await updateSchedule();
	});

  async function selectDay (weekday) {
    if (!weekday.valid) { return }
    $$invalidate('selected', selected = weekday.number);
    dispatch('select', { year: currentDate.year(), month: currentDate.month() + 1, day: weekday.number });
  }

	async function updateSchedule () {
		$$invalidate('schedule', schedule = await fetchSchedule(currentDate.year(), currentDate.month() + 1) || {});
	}

  async function next () {
		$$invalidate('currentDate', currentDate = currentDate.add(1, 'month'));
		await updateSchedule();
  }
  
  async function prev () {
		$$invalidate('currentDate', currentDate = currentDate.subtract(1, 'month'));
		await updateSchedule();
	}
	
	let { fetchSchedule } = $$props;

	function click_handler({ weekday }, e) {
		return selectDay(weekday);
	}

	$$self.$set = $$props => {
		if ('fetchSchedule' in $$props) $$invalidate('fetchSchedule', fetchSchedule = $$props.fetchSchedule);
	};

	return {
		dayNames,
		currentDate,
		schedule,
		selected,
		selectDay,
		next,
		prev,
		fetchSchedule,
		click_handler
	};
}

class Scheduler extends SvelteComponent {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-1v4przp-style")) add_css();
		init(this, options, instance, create_fragment$2, safe_not_equal, ["fetchSchedule"]);
	}
}

function randomColour () {
  return `hsla(${~~(360 * Math.random())}, 70%, 80%, 1)`
}

/* demo/EventList.svelte generated by Svelte v3.8.0 */

function add_css$1() {
	var style = element("style");
	style.id = 'svelte-1b2yfin-style';
	style.textContent = ".outer.svelte-1b2yfin{margin-top:6px;display:-webkit-box;display:flex;-webkit-box-align:center;align-items:center;-webkit-box-pack:start;justify-content:flex-start;height:100%;width:100%}.dot.svelte-1b2yfin{display:none;height:10px;width:10px;border-radius:50%}.info.svelte-1b2yfin{display:-webkit-box;display:flex;border-radius:5px;padding:3px 6px}@media only screen and (max-device-width: 700px){.dot.svelte-1b2yfin{display:-webkit-box;display:flex}.info.svelte-1b2yfin{display:none}}";
	append(document.head, style);
}

function create_fragment$3(ctx) {
	var div2, div0, t0, div1, t1_value = ctx.info() + "", t1;

	return {
		c() {
			div2 = element("div");
			div0 = element("div");
			t0 = space();
			div1 = element("div");
			t1 = text(t1_value);
			attr(div0, "class", "dot svelte-1b2yfin");
			set_style(div0, "background-color", randomColour());
			attr(div1, "class", "info svelte-1b2yfin");
			set_style(div1, "background-color", randomColour());
			attr(div2, "class", "outer svelte-1b2yfin");
		},

		m(target, anchor) {
			insert(target, div2, anchor);
			append(div2, div0);
			append(div2, t0);
			append(div2, div1);
			append(div1, t1);
		},

		p(changed, ctx) {
			if (changed.randomColour) {
				set_style(div0, "background-color", randomColour());
				set_style(div1, "background-color", randomColour());
			}
		},

		i: noop,
		o: noop,

		d(detaching) {
			if (detaching) {
				detach(div2);
			}
		}
	};
}

function instance$1($$self, $$props, $$invalidate) {
	let { events } = $$props;

  function info () {
    return `${events.length} event${events.length > 1 ? 's' : ''}`
  }

	$$self.$set = $$props => {
		if ('events' in $$props) $$invalidate('events', events = $$props.events);
	};

	return { events, info };
}

class EventList extends SvelteComponent {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-1b2yfin-style")) add_css$1();
		init(this, options, instance$1, create_fragment$3, safe_not_equal, ["events"]);
	}
}

/* demo/Popdown.svelte generated by Svelte v3.8.0 */

function add_css$2() {
	var style = element("style");
	style.id = 'svelte-zbj9or-style';
	style.textContent = ".container.svelte-zbj9or{display:-webkit-box;display:flex;-webkit-box-orient:vertical;-webkit-box-direction:normal;flex-direction:column;width:100%}.item.svelte-zbj9or{display:-webkit-box;display:flex;width:100%;box-sizing:border-box}.item.background-on.svelte-zbj9or{background-color:lightgrey}.item.svelte-zbj9or>.time.svelte-zbj9or{display:-webkit-box;display:flex;-webkit-box-pack:end;justify-content:flex-end;-webkit-box-align:center;align-items:center;border-right:3px solid lightblue;width:4rem;padding:1rem 1rem 1rem 0.75rem;font-size:14px;font-weight:bold}.item.svelte-zbj9or>.description.svelte-zbj9or{-webkit-box-flex:1;flex:1;text-align:left;padding:1rem 2rem 1rem 2rem}";
	append(document.head, style);
}

function get_each_context$1(ctx, list, i) {
	const child_ctx = Object.create(ctx);
	child_ctx.event = list[i];
	child_ctx.i = i;
	return child_ctx;
}

// (2:2) {#each events as event, i}
function create_each_block$1(ctx) {
	var div4, div0, t0_value = ctx.event.time + "", t0, t1, div3, div1, t2_value = ctx.event.name + "", t2, t3, div2, t5;

	return {
		c() {
			div4 = element("div");
			div0 = element("div");
			t0 = text(t0_value);
			t1 = space();
			div3 = element("div");
			div1 = element("div");
			t2 = text(t2_value);
			t3 = space();
			div2 = element("div");
			div2.textContent = "4 guests";
			t5 = space();
			attr(div0, "class", "time svelte-zbj9or");
			set_style(div0, "border-right-color", randomColour());
			attr(div3, "class", "description svelte-zbj9or");
			attr(div4, "class", "item svelte-zbj9or");
			toggle_class(div4, "background-on", ctx.i % 2 == 1);
		},

		m(target, anchor) {
			insert(target, div4, anchor);
			append(div4, div0);
			append(div0, t0);
			append(div4, t1);
			append(div4, div3);
			append(div3, div1);
			append(div1, t2);
			append(div3, t3);
			append(div3, div2);
			append(div4, t5);
		},

		p(changed, ctx) {
			if ((changed.events) && t0_value !== (t0_value = ctx.event.time + "")) {
				set_data(t0, t0_value);
			}

			if (changed.randomColour) {
				set_style(div0, "border-right-color", randomColour());
			}

			if ((changed.events) && t2_value !== (t2_value = ctx.event.name + "")) {
				set_data(t2, t2_value);
			}
		},

		d(detaching) {
			if (detaching) {
				detach(div4);
			}
		}
	};
}

function create_fragment$4(ctx) {
	var div;

	var each_value = ctx.events;

	var each_blocks = [];

	for (var i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
	}

	return {
		c() {
			div = element("div");

			for (var i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}
			attr(div, "class", "container svelte-zbj9or");
		},

		m(target, anchor) {
			insert(target, div, anchor);

			for (var i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(div, null);
			}
		},

		p(changed, ctx) {
			if (changed.events || changed.randomColour) {
				each_value = ctx.events;

				for (var i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$1(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(changed, child_ctx);
					} else {
						each_blocks[i] = create_each_block$1(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}
				each_blocks.length = each_value.length;
			}
		},

		i: noop,
		o: noop,

		d(detaching) {
			if (detaching) {
				detach(div);
			}

			destroy_each(each_blocks, detaching);
		}
	};
}

function instance$2($$self, $$props, $$invalidate) {
	let { events } = $$props;

	$$self.$set = $$props => {
		if ('events' in $$props) $$invalidate('events', events = $$props.events);
	};

	return { events };
}

class Popdown extends SvelteComponent {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-zbj9or-style")) add_css$2();
		init(this, options, instance$2, create_fragment$4, safe_not_equal, ["events"]);
	}
}

/* demo/Demo.svelte generated by Svelte v3.8.0 */

function create_fragment$5(ctx) {
	var div, updating_fetchSchedule, current;

	function scheduler_fetchSchedule_binding(value) {
		ctx.scheduler_fetchSchedule_binding.call(null, value);
		updating_fetchSchedule = true;
		add_flush_callback(() => updating_fetchSchedule = false);
	}

	let scheduler_props = {};
	if (ctx.fetchSchedule !== void 0) {
		scheduler_props.fetchSchedule = ctx.fetchSchedule;
	}
	var scheduler = new Scheduler({ props: scheduler_props });

	binding_callbacks.push(() => bind(scheduler, 'fetchSchedule', scheduler_fetchSchedule_binding));
	scheduler.$on("select", ctx.select);

	return {
		c() {
			div = element("div");
			scheduler.$$.fragment.c();
		},

		m(target, anchor) {
			insert(target, div, anchor);
			mount_component(scheduler, div, null);
			current = true;
		},

		p(changed, ctx) {
			var scheduler_changes = {};
			if (!updating_fetchSchedule && changed.fetchSchedule) {
				scheduler_changes.fetchSchedule = ctx.fetchSchedule;
			}
			scheduler.$set(scheduler_changes);
		},

		i(local) {
			if (current) return;
			transition_in(scheduler.$$.fragment, local);

			current = true;
		},

		o(local) {
			transition_out(scheduler.$$.fragment, local);
			current = false;
		},

		d(detaching) {
			if (detaching) {
				detach(div);
			}

			destroy_component(scheduler);
		}
	};
}

function instance$3($$self, $$props, $$invalidate) {
	

  let events = null;

  async function fetchSchedule (year, month) {
    return justSafeGet(schedules, [ year, month ])
  }

  async function select (e) {
    const { year, month, day } = e.detail;
    events = justSafeGet(schedules, [ year, month, day, 'props', 'events' ]);
  }

  const schedules = {
    2019: {
      8: {
        22: {
          component: EventList,
          popdown: Popdown,
          props: {
            events: [
              { name: 'Lunch with Lyn', time: '13:30' },
              { name: 'Dinner With Steve', time: '23:00' }
            ]
          }
        }
      }
    }
  };

	function scheduler_fetchSchedule_binding(value) {
		fetchSchedule = value;
		$$invalidate('fetchSchedule', fetchSchedule);
	}

	return {
		fetchSchedule,
		select,
		scheduler_fetchSchedule_binding
	};
}

class Demo extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$3, create_fragment$5, safe_not_equal, []);
	}
}

const target = document.createElement('div');
document.body.appendChild(target);

new Demo({
  target,
  props: {}
});
