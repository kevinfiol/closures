let EMPTY_OBJECT = {},
  REF_SINGLE = 1, // ref with a single dom node
  REF_ARRAY = 4, // ref with an array od nodes
  REF_PARENT = 8, // ref with a child ref
  SVG_NS = "http://www.w3.org/2000/svg",
  DOM_PROPS_DIRECTIVES = {
    selected: propDirective("selected"),
    checked: propDirective("checked"),
    value: propDirective("value"),
    innerHTML: propDirective("innerHTML"),
  },
  DEFAULT_ENV = {
    isSvg: false,
    directives: DOM_PROPS_DIRECTIVES,
  },
  ON_REMOVES = [],
  MOUNTING = [],
  XLINK_NS = "http://www.w3.org/1999/xlink",
  NS_ATTRS = { show: XLINK_NS, actuate: XLINK_NS, href: XLINK_NS },
  NUM = 1,
  VTYPE_ELEMENT = 1,
  VTYPE_FUNCTION = 2,
  VTYPE_COMPONENT = 4,
  CLOSURE_TO_CMP = new WeakMap(),
  CMP_TO_CLOSURE = new WeakMap(),
  CHILDS = new WeakMap(),
  ID = _ => (NUM++).toString(),
  noop = _ => {},
  isFn = x => typeof x === 'function',
  isStr = x => typeof x === 'string',
  isObj = x => x !== null && typeof x === 'object',
  isArr = x => Array.isArray(x),
  isEmpty = c => c === null || c === false || c === undefined || (isArr(c) && c.length === 0),
  isNonEmptyArray = c => isArr(c) && c.length > 0,
  isLeaf = c => isStr(c) || typeof c === "number",
  isElement = c => c && c.vtype === VTYPE_ELEMENT,
  isRenderFunction = c => c && c.vtype === VTYPE_FUNCTION,
  isComponent = c => c && c.vtype === VTYPE_COMPONENT,
  isValidComponentType = c => c && isFn(c.mount);

export const m = h;

export const onRemove = f => ON_REMOVES.push(f);

export function h(__tag, ...children) {
  let props = children[0];
  if (props && isObj(props) && !isArr(props) && !(props.__tag || props.props))
    children.shift();
  else props = EMPTY_OBJECT;

  props =
    children.length > 1
      ? Object.assign({}, props, { children })
      : children.length === 1
      ? Object.assign({}, props, { children: children[0] })
      : props;

  // parse tag
  if (isStr(__tag)) {
    let idx = __tag.indexOf('.');
    if (~idx) {
      let className = __tag.slice(idx + 1).replace(/\./g, ' ')
      props.class = props.class ? className + ' ' + String(props.class) : className;
      __tag = __tag.slice(0, idx);
    }
    __tag = __tag ?? 'div';
  }

  return jsx(__tag, props, props.key);
}

export function jsx(__tag, props, key) {
  if (key !== key) throw new Error("Invalid NaN key");
  let vtype =
    isStr(__tag)
      ? VTYPE_ELEMENT
      : isValidComponentType(__tag)
      ? VTYPE_COMPONENT
      : isFn(__tag)
      ? VTYPE_FUNCTION
      : undefined;
  if (vtype === undefined) throw new Error("Invalid VNode type");
  return {
    vtype,
    __tag,
    key,
    props,
  };
}

export const Fragment = props => props.children;

export function render(vnode, parentDomNode, options = {}) {
  let rootRef = parentDomNode.$$PETIT_DOM_REF;
  let env = Object.assign({}, DEFAULT_ENV);
  Object.assign(env.directives, options.directives);
  if (rootRef == null) {
    let ref = mount(vnode, env);
    parentDomNode.$$PETIT_DOM_REF = { ref, vnode };
    parentDomNode.textContent = "";
    insertDom(parentDomNode, ref, null);
  } else {
    rootRef.ref = patchInPlace(
      parentDomNode,
      vnode,
      rootRef.vnode,
      rootRef.ref,
      env
    );
    rootRef.vnode = vnode;
  }
}

// non exports
class Renderer {
  constructor(props, env) {
    this.props = props;
    this._STATE_ = {
      env,
      vnode: null,
      parentDomNode: null,
      ref: mount(null)
    };
    this.render = this.render.bind(this);
  }

  setProps(props) {
    this.oldProps = this.props;
    this.props = props;
  }

  render(vnode) {
    let state = this._STATE_;
    let oldVNode = state.vnode;
    state.vnode = vnode;
    if (state.parentDomNode === null) {
      let parentNode = getParentNode(state.ref);
      if (parentNode === null) {
        state.ref = mount(vnode, state.env);
        return;
      } else {
        state.parentDomNode = parentNode;
      }
    }
    // here we are sure state.parentDOMNode is defined
    state.ref = patchInPlace(
      state.parentDomNode,
      vnode,
      oldVNode,
      state.ref,
      state.env
    );
  }
}

function mount(vnode, env = DEFAULT_ENV) {
  if (isEmpty(vnode)) {
    return {
      type: REF_SINGLE,
      node: document.createComment("NULL"),
    };
  } else if (isLeaf(vnode)) {
    return {
      type: REF_SINGLE,
      node: document.createTextNode(vnode),
    };
  } else if (isElement(vnode)) {
    let node;
    let { __tag, props } = vnode;
    if (__tag === "svg" && !env.isSvg) {
      env = Object.assign({}, env, { isSVG: true });
    }
    // TODO : {is} for custom elements
    if (!env.isSVG) {
      node = document.createElement(__tag);
    } else {
      node = document.createElementNS(SVG_NS, __tag);
    }

    // element lifecycle hooks
    if (isFn(props.oncreate)) props.oncreate(node);

    mountAttributes(node, props, env);
    let childrenRef =
      props.children == null ? props.children : mount(props.children, env);
    /**
     * We need to insert content before setting interactive props
     * that rely on children been present (e.g select)
     */
    if (childrenRef != null) insertDom(node, childrenRef);
    mountDirectives(node, props, env);
    return {
      type: REF_SINGLE,
      node,
      children: childrenRef,
    };
  } else if (isNonEmptyArray(vnode)) {
    return {
      type: REF_ARRAY,
      children: vnode.map((child) => mount(child, env)),
    };
  } else if (isRenderFunction(vnode)) {
    let childVNode = vnode.__tag(vnode.props);

    if (isFn(childVNode)) {
      let cmp,
        view = childVNode,
        id = ID(),
        cmps = CLOSURE_TO_CMP.get(vnode.__tag) ?? {};
      
      vnode.id = id;
      cmp = toClosureCmp(vnode, view)
      
      cmps[id] = cmp;
      CLOSURE_TO_CMP.set(vnode.__tag, cmps);
      CMP_TO_CLOSURE.set(cmp, vnode.__tag);
      return mount(cmp);
    }

    let childRef = mount(childVNode, env);
    return {
      type: REF_PARENT,
      childRef,
      childState: childVNode,
    };
  } else if (isComponent(vnode)) {
    let renderer = new Renderer(vnode.props, env);

    let parentCmp;
    if (parentCmp = MOUNTING[MOUNTING.length - 1]) {
      let child_closure = CMP_TO_CLOSURE.get(vnode),
        childs = CHILDS.get(parentCmp) || [],
        idx = childs.length;
        
      // attach method to remove self from parent
      vnode.__tag.removeFromParent = _ => childs.splice(idx, 1);

      childs.push({
        id: vnode.id,
        vtype: VTYPE_FUNCTION,
        __tag: child_closure
      });

      CHILDS.set(parentCmp, childs);
    }

    vnode.__tag.mount(renderer);
    return {
      type: REF_PARENT,
      childRef: renderer._STATE_.ref,
      childState: renderer,
    };
  } else if (vnode instanceof Node) {
    return {
      type: REF_SINGLE,
      node: vnode,
    };
  }
  if (vnode === undefined) {
    throw new Error("mount: vnode is undefined!");
  }

  throw new Error("mount: Invalid Vnode!");
}

function patch(
  parentDomNode,
  newVNode,
  oldVNode,
  ref,
  env = DEFAULT_ENV
) {
  if (isObj(oldVNode) && isObj(newVNode))
    newVNode.id = oldVNode.id;

  if (oldVNode === newVNode) {
    return ref;
  } else if (isEmpty(newVNode) && isEmpty(oldVNode)) {
    return ref;
  } else if (isLeaf(newVNode) && isLeaf(oldVNode)) {
    ref.node.nodeValue = newVNode;
    return ref;
  } else if (
    isElement(newVNode) &&
    isElement(oldVNode) &&
    newVNode.__tag === oldVNode.__tag
  ) {
    if (newVNode.__tag === "svg" && !env.isSvg) {
      env = Object.assign({}, env, { isSVG: true });
    }
    patchAttributes(ref.node, newVNode.props, oldVNode.props, env);
    let oldChildren = oldVNode.props.children;
    let newChildren = newVNode.props.children;
    if (oldChildren == null) {
      if (newChildren != null) {
        ref.children = mount(newChildren, env);
        insertDom(ref.node, ref.children);
      }
    } else {
      if (newChildren == null) {
        ref.node.textContent = "";
        unmount(oldChildren, ref.children, env);
        ref.children = null;
      } else {
        ref.children = patchInPlace(
          ref.node,
          newChildren,
          oldChildren,
          ref.children,
          env
        );
      }
    }
    patchDirectives(ref.node, newVNode.props, oldVNode.props, env);
    return ref;
  } else if (isNonEmptyArray(newVNode) && isNonEmptyArray(oldVNode)) {
    patchChildren(parentDomNode, newVNode, oldVNode, ref, env);
    return ref;
  } else if (
    isRenderFunction(newVNode) &&
    isRenderFunction(oldVNode) &&
    newVNode.__tag === oldVNode.__tag
  ) {
    let renderFn = newVNode.__tag;
    let shouldUpdate =
      renderFn.shouldUpdate != null
        ? renderFn.shouldUpdate(oldVNode.props, newVNode.props)
        : defaultShouldUpdate(oldVNode.props, newVNode.props);
    if (shouldUpdate) {
      let cmp,
        id = oldVNode.id,
        cmps = CLOSURE_TO_CMP.get(renderFn);

      if (cmps && id && (cmp = cmps[id])) {
        return patch(
          parentDomNode,
          { ...cmp, props: newVNode.props },
          cmp,
          ref
        );
      }

      let childVNode = renderFn(newVNode.props);
      let childRef = patch(
        parentDomNode,
        childVNode,
        ref.childState,
        ref.childRef,
        env
      );
      // We need to return a new ref in order for parent patches to
      // properly replace changing DOM nodes
      if (childRef !== ref.childRef) {
        return {
          type: REF_PARENT,
          childRef,
          childState: childVNode,
        };
      } else {
        ref.childState = childVNode;
        return ref;
      }
    } else {
      return ref;
    }
  } else if (
    isComponent(newVNode) &&
    isComponent(oldVNode) &&
    newVNode.__tag === oldVNode.__tag
  ) {
    let renderer = ref.childState;
    let state = renderer._STATE_;
    state.env = env;
    state.parentNode = parentDomNode;
    renderer.setProps(newVNode.props);
    newVNode.__tag.patch(renderer);
    if (ref.childRef !== state.ref) {
      return {
        type: REF_PARENT,
        childRef: state.ref,
        childState: renderer,
      };
    } else {
      return ref;
    }
  } else if (newVNode instanceof Node && oldVNode instanceof Node) {
    ref.node = newVNode;
    return ref;
  } else {
    return mount(newVNode, env);
  }
}

/**
 * Execute any compoenent specific unmount code
 */
function unmount(vnode, ref, env) {
  // if (vnode instanceof Node ||  isEmpty(vnode) || isLeaf(vnode)) return;
  if (isElement(vnode)) {
    unmountDirectives(ref.node, vnode.props, env);
    if (vnode.props.children != null)
      unmount(vnode.props.children, ref.children, env);
  } else if (isNonEmptyArray(vnode)) {
    vnode.forEach((childVNode, index) =>
      unmount(childVNode, ref.children[index], env)
    );
  } else if (isRenderFunction(vnode)) {
    let cmp, cmps = CLOSURE_TO_CMP.get(vnode.__tag);
    if (cmps && vnode.id && (cmp = cmps[vnode.id])) {
      delete cmps[vnode.id];
      CMP_TO_CLOSURE.delete(cmp);
      return unmount(cmp, ref, env);
    }

    unmount(ref.childState, ref.childRef, env);
  } else if (isComponent(vnode)) {
    vnode.__tag.unmount(ref.childState);
  }
}

function patchInPlace(parentDomNode, newVNode, oldVNode, ref, env) {
  let newRef = patch(parentDomNode, newVNode, oldVNode, ref, env);
  if (newRef !== ref) {
    replaceDom(parentDomNode, newRef, ref);
    unmount(oldVNode, ref, env);
  }
  return newRef;
}

function patchChildren(parentDomNode, newChildren, oldchildren, ref, env) {
  // We need to retreive the next sibling before the old children
  // get eventually removed from the current DOM document
  let nextNode = getNextSibling(ref);
  let children = Array(newChildren.length);
  let refChildren = ref.children;
  let newStart = 0,
    oldStart = 0,
    newEnd = newChildren.length - 1,
    oldEnd = oldchildren.length - 1;
  let oldVNode, newVNode, oldRef, newRef, refMap;

  while (newStart <= newEnd && oldStart <= oldEnd) {
    if (refChildren[oldStart] === null) {
      oldStart++;
      continue;
    }
    if (refChildren[oldEnd] === null) {
      oldEnd--;
      continue;
    }

    oldVNode = oldchildren[oldStart];
    newVNode = newChildren[newStart];
    if (newVNode.key === oldVNode.key) {
      oldRef = refChildren[oldStart];
      newRef = children[newStart] = patchInPlace(
        parentDomNode,
        newVNode,
        oldVNode,
        oldRef,
        env
      );
      newStart++;
      oldStart++;
      continue;
    }

    oldVNode = oldchildren[oldEnd];
    newVNode = newChildren[newEnd];
    if (newVNode.key === oldVNode.key) {
      oldRef = refChildren[oldEnd];
      newRef = children[newEnd] = patchInPlace(
        parentDomNode,
        newVNode,
        oldVNode,
        oldRef,
        env
      );
      newEnd--;
      oldEnd--;
      continue;
    }

    if (refMap == null) {
      refMap = {};
      for (let i = oldStart; i <= oldEnd; i++) {
        oldVNode = oldchildren[i];
        if (oldVNode.key != null) {
          refMap[oldVNode.key] = i;
        }
      }
    }

    newVNode = newChildren[newStart];
    let idx = newVNode.key != null ? refMap[newVNode.key] : null;
    if (idx != null) {
      oldVNode = oldchildren[idx];
      oldRef = refChildren[idx];
      newRef = children[newStart] = patch(
        parentDomNode,
        newVNode,
        oldVNode,
        oldRef,
        env
      );
      insertDom(parentDomNode, newRef, getDomNode(refChildren[oldStart]));
      if (newRef !== oldRef) {
        removeDom(parentDomNode, oldRef);
        unmount(oldVNode, oldRef, env);
      }
      refChildren[idx] = null;
    } else {
      newRef = children[newStart] = mount(newVNode, env);
      insertDom(parentDomNode, newRef, getDomNode(refChildren[oldStart]));
    }
    newStart++;
  }

  let beforeNode =
    newEnd < newChildren.length - 1
      ? getDomNode(children[newEnd + 1])
      : nextNode;
  while (newStart <= newEnd) {
    let newRef = mount(newChildren[newStart], env);
    children[newStart] = newRef;
    insertDom(parentDomNode, newRef, beforeNode);
    newStart++;
  }
  while (oldStart <= oldEnd) {
    oldRef = refChildren[oldStart];
    if (oldRef != null) {
      removeDom(parentDomNode, oldRef);
      unmount(oldchildren[oldStart], oldRef, env);
    }
    oldStart++;
  }
  ref.children = children;
}

function defaultShouldUpdate(p1, p2) {
  if (p1 === p2) return false;
  for (let key in p2) {
    if (p1[key] !== p2[key]) return true;
  }
  return false;
}

function propDirective(prop) {
  return {
    mount(element, value) {``
      element[prop] = value;
    },
    patch(element, newValue, oldValue) {
      if (newValue !== oldValue) {
        element[prop] = newValue;
      }
    },
    unmount(element, _) {
      element[prop] = null;
    },
  };
}

function getDomNode(ref) {
  if (ref.type === REF_SINGLE) {
    return ref.node;
  } else if (ref.type === REF_ARRAY) {
    return getDomNode(ref.children[0]);
  } else if (ref.type === REF_PARENT) {
    return getDomNode(ref.childRef);
  }
  throw new Error("Unkown ref type " + JSON.stringify(ref));
}

function getParentNode(ref) {
  if (ref.type === REF_SINGLE) {
    return ref.node.parentNode;
  } else if (ref.type === REF_ARRAY) {
    return getParentNode(ref.children[0]);
  } else if (ref.type === REF_PARENT) {
    return getParentNode(ref.childRef);
  }
  throw new Error("Unkown ref type " + ref);
}

function getNextSibling(ref) {
  if (ref.type === REF_SINGLE) {
    return ref.node.nextSibling;
  } else if (ref.type === REF_ARRAY) {
    return getNextSibling(ref.children[ref.children.length - 1]);
  } else if (ref.type === REF_PARENT) {
    return getNextSibling(ref.childRef);
  }
  throw new Error("Unkown ref type " + JSON.stringify(ref));
}

function insertDom(parent, ref, nextSibling) {
  if (ref.type === REF_SINGLE) {
    parent.insertBefore(ref.node, nextSibling);
  } else if (ref.type === REF_ARRAY) {
    ref.children.forEach((ch) => {
      insertDom(parent, ch, nextSibling);
    });
  } else if (ref.type === REF_PARENT) {
    insertDom(parent, ref.childRef, nextSibling);
  } else {
    throw new Error("Unkown ref type " + JSON.stringify(ref));
  }
}

function removeDom(parent, ref) {
  if (ref.type === REF_SINGLE) {
    parent.removeChild(ref.node);
  } else if (ref.type === REF_ARRAY) {
    ref.children.forEach((ch) => {
      removeDom(parent, ch);
    });
  } else if (ref.type === REF_PARENT) {
    removeDom(parent, ref.childRef);
  } else {
    throw new Error("Unkown ref type " + ref);
  }
}

function replaceDom(parent, newRef, oldRef) {
  insertDom(parent, newRef, getDomNode(oldRef));
  removeDom(parent, oldRef);
}

function mountDirectives(domElement, props, env) {
  for (let key in props) {
    if (key in env.directives) {
      env.directives[key].mount(domElement, props[key]);
    }
  }
}

function patchDirectives(domElement, newProps, oldProps, env) {
  for (let key in newProps) {
    if (key in env.directives) {
      env.directives[key].patch(domElement, newProps[key], oldProps[key]);
    }
  }
  for (let key in oldProps) {
    if (key in env.directives && !(key in newProps)) {
      env.directives[key].unmount(domElement, oldProps[key]);
    }
  }
}

function unmountDirectives(domElement, props, env) {
  for (let key in props) {
    if (key in env.directives) {
      env.directives[key].unmount(domElement, props[key]);
    }
  }
}

function mountAttributes(domElement, props, env) {
  for (var key in props) {
    if (key === "key" || key === "children" || key in env.directives) continue;
    if (key.startsWith("on")) {
      let cmp = MOUNTING[MOUNTING.length - 1];
      domElement[key.toLowerCase()] = cmp ? cmp.__tag.event(props[key]) : props[key];
    } else {
      setDOMAttribute(domElement, key, props[key], env.isSVG);
    }
  }
}

function patchAttributes(domElement, newProps, oldProps, env) {
  for (var key in newProps) {
    if (key === "key" || key === "children" || key in env.directives) continue;
    var oldValue = oldProps[key];
    var newValue = newProps[key];
    if (oldValue !== newValue) {
      if (key.startsWith("on")) {
        let cmp = MOUNTING[MOUNTING.length - 1];
        domElement[key.toLowerCase()] = cmp ? cmp.__tag.event(newValue) : newValue;
      } else {
        setDOMAttribute(domElement, key, newValue, env.isSVG);
      }
    }
  }
  for (key in oldProps) {
    if (
      key === "key" ||
      key === "children" ||
      key in env.directives ||
      key in newProps
    )
      continue;
    if (key.startsWith("on")) {
      domElement[key.toLowerCase()] = null;
    } else {
      domElement.removeAttribute(key);
    }
  }
}

function setDOMAttribute(el, attr, value, isSVG) {
  if (value === true) {
    el.setAttribute(attr, "");
  } else if (value === false) {
    el.removeAttribute(attr);
  } else {
    var namespace = isSVG ? NS_ATTRS[attr] : undefined;
    if (namespace !== undefined) {
      el.setAttributeNS(namespace, attr, value);
    } else {
      el.setAttribute(attr, value);
    }
  }
}

function toClosureCmp(vnode, view) {
  let onRemove = ON_REMOVES.pop() ?? noop,
    cmp = {
      key: vnode.key,
      id: vnode.id,
      vtype: VTYPE_COMPONENT,
      props: vnode.props || {},
      __tag: {
        view,
        removeFromParent: noop,
        event: noop,
        mount: render,
        patch: render,
        unmount: _ => {
          onRemove();
          let childs;
          if (childs = CHILDS.get(cmp)) {
            for (let i = 0; i < childs.length; i++) {
              unmount(childs[i], EMPTY_OBJECT);
            }

            CHILDS.delete(cmp);
          }
          
          cmp.__tag.removeFromParent();
        }
      }
    };
  
  function render(ctx) {
    cmp.__tag.event = fn => ev => {
      fn(ev);
      MOUNTING.push(cmp);
      ctx.render(view({ ...ctx.props }));
      MOUNTING.pop();
    };

    MOUNTING.push(cmp);
    ctx.render(view({ ...ctx.props }));
    MOUNTING.pop();
  }

  return cmp;
}
