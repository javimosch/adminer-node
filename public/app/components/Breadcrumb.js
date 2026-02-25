import { inject } from 'vue';

export default {
  name: 'Breadcrumb',
  props: {
    crumbs: { type: Array, default: () => [] },
  },
  setup() {
    const navigate = inject('navigate');
    return { navigate };
  },
  template: `
    <div class="text-sm breadcrumbs">
      <ul>
        <li v-for="(crumb, i) in crumbs" :key="i">
          <a v-if="i < crumbs.length - 1"
            @click.prevent="navigate(crumb.path)"
            :href="'#' + crumb.path"
            class="link link-hover font-medium">{{ crumb.label }}</a>
          <span v-else class="font-semibold text-base-content">{{ crumb.label }}</span>
        </li>
      </ul>
    </div>
  `,
};
