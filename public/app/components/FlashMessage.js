import { inject } from 'vue';

export default {
  name: 'FlashMessage',
  setup() {
    const store = inject('store');
    return { store };
  },
  template: `
    <div class="toast toast-top toast-end z-50" v-if="store.messages.length">
      <div
        v-for="msg in store.messages"
        :key="msg.id"
        :class="['alert', 'shadow-lg', 'min-w-72',
          msg.type === 'success' ? 'alert-success' :
          msg.type === 'error'   ? 'alert-error' : 'alert-info']"
      >
        <span class="text-sm">{{ msg.text }}</span>
        <button class="btn btn-xs btn-ghost" @click="store.dismissMessage(msg.id)">✕</button>
      </div>
    </div>
  `,
};
