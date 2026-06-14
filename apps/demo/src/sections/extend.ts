import { animate, numberValueType, registerValueType } from '@underlying/core'
import { button, h, type Section } from '../showcase'

// Explicit, app-level registration: a custom property animated as a plain
// number. This is the exact extension mechanism @underlying/scroll and
// @underlying/color will use. Done once at module load (never inside library
// import side effects, which a tree-shaker would drop).
registerValueType(['--progress'], numberValueType)

export const customTypes: Section = {
  id: 'custom-types',
  group: 'Extending',
  title: 'Custom value types',
  tagline: 'Register a descriptor for any property - the package extension point.',
  description: `
    <p>The value-type registry is open. <code>registerValueType(props, type)</code>
    teaches <code>animate()</code> how to drive a property - here a custom
    property <code>--progress</code> as a plain number, with CSS turning it into a
    width via <code>calc()</code>. The built-in <code>numberValueType</code>,
    <code>lengthValueType</code>, <code>colorValueType</code>, and
    <code>complexValueType</code> are all exported for composition.</p>`,
  code: `import { animate, registerValueType, numberValueType } from '@underlying/core'

registerValueType(['--progress'], numberValueType)   // explicit, in app code

// CSS:  .meter > i { width: calc(var(--progress, 0) * 100%) }
animate(meter, { '--progress': 0.8 }, { stiffness: 180, damping: 22 })`,
  api: `registerValueType(properties: string[], type: ValueType): void
// exported built-ins: numberValueType, lengthValueType, colorValueType, complexValueType`,
  run(ctx) {
    const meter = h('div', { style: 'width:100%;height:22px;border-radius:11px;background:var(--tint);border:1px solid var(--ligne);overflow:hidden' })
    const fill = h('i', { style: '--progress:0.1;display:block;height:100%;width:calc(var(--progress) * 100%);background:var(--sapin)' })
    meter.append(fill)
    const label = h('div', { style: 'font-size:12px;color:var(--lichen);margin-top:8px' }, '--progress: 0.1')
    ctx.stage.append(h('div', { style: 'width:100%' }, meter, label))

    const set = (value: number) => {
      label.textContent = `--progress: ${value}`
      animate(fill, { '--progress': value }, { stiffness: 180, damping: 22 })
    }
    ctx.controls.append(
      button('10%', () => set(0.1)),
      button('50%', () => set(0.5)),
      button('80%', () => set(0.8)),
      button('100%', () => set(1)),
    )
  },
}
