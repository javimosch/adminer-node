import { ref, onMounted, watch } from 'vue';

export default {
  name: 'SqlEditor',
  props: {
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: 'Enter SQL…' },
    rows: { type: Number, default: 8 },
    readonly: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'run'],
  setup(props, { emit }) {
    const textareaRef = ref(null);

    function onInput(e) {
      emit('update:modelValue', e.target.value);
    }

    function onKeydown(e) {
      // Ctrl+Enter or Cmd+Enter → run
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        emit('run');
      }
      // Tab → insert 2 spaces
      if (e.key === 'Tab') {
        e.preventDefault();
        const el = e.target;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const newVal = el.value.slice(0, start) + '  ' + el.value.slice(end);
        emit('update:modelValue', newVal);
        // Restore cursor after Vue re-renders
        setTimeout(() => {
          el.selectionStart = el.selectionEnd = start + 2;
        }, 0);
      }
    }

    // Highlight a display-only code block (non-editable mode)
    onMounted(() => {
      if (props.readonly && typeof hljs !== 'undefined') {
        // Highlight is applied via class; hljs.highlightAll() picks it up
        hljs.highlightAll();
      }
    });

    watch(() => props.modelValue, () => {
      // Keep textarea value in sync when changed externally
    });

    return { textareaRef, onInput, onKeydown };
  },
  template: `
    <div class="relative">
      <textarea
        ref="textareaRef"
        :value="modelValue"
        :placeholder="placeholder"
        :rows="rows"
        :readonly="readonly"
        @input="onInput"
        @keydown="onKeydown"
        class="textarea textarea-bordered font-mono text-sm w-full resize-y leading-relaxed"
        :class="readonly ? 'bg-base-200 cursor-default' : ''"
        spellcheck="false"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
      ></textarea>
      <div v-if="!readonly" class="absolute bottom-2 right-2 text-xs text-base-content/40 pointer-events-none">
        Ctrl+Enter to run
      </div>
    </div>
  `,
};
