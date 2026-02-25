export default {
  name: 'Modal',
  props: {
    title: { type: String, default: 'Confirm' },
    confirmLabel: { type: String, default: 'Confirm' },
    confirmClass: { type: String, default: 'btn-error' },
    open: { type: Boolean, default: false },
  },
  emits: ['confirm', 'cancel'],
  template: `
    <dialog v-if="open" class="modal modal-open">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">{{ title }}</h3>
        <slot />
        <div class="modal-action">
          <button :class="['btn', confirmClass]" @click="$emit('confirm')">{{ confirmLabel }}</button>
          <button class="btn btn-ghost" @click="$emit('cancel')">Cancel</button>
        </div>
      </div>
      <div class="modal-backdrop" @click="$emit('cancel')"></div>
    </dialog>
  `,
};
