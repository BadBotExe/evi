import { isAtlasImageAsset, resolveImageAssetCandidate } from '../app/imageAtlas.js?v=0e96ee83c0';

export const SpriteImage = {
    props: {
        image: {
            type: [Object, String],
            default: null
        },
        fallbackSrc: {
            type: String,
            default: ''
        },
        alt: {
            type: String,
            default: ''
        },
        imgClass: {
            type: String,
            default: ''
        },
        placeholderClass: {
            type: String,
            default: 'src-img-ph'
        }
    },
    data() {
        return {
            failed: false
        };
    },
    watch: {
        image() {
            this.failed = false;
        },
        fallbackSrc() {
            this.failed = false;
        }
    },
    computed: {
        resolvedImage() {
            return resolveImageAssetCandidate(this.image, this.fallbackSrc);
        },
        isAtlas() {
            return isAtlasImageAsset(this.resolvedImage);
        },
        resolvedUrl() {
            return typeof this.resolvedImage === 'string' ? this.resolvedImage : '';
        },
        viewBox() {
            if (!this.isAtlas) return '0 0 1 1';
            return `0 0 ${this.resolvedImage.width} ${this.resolvedImage.height}`;
        }
    },
    methods: {
        onError() {
            this.failed = true;
        }
    },
    template: `
        <svg v-if="isAtlas && !failed"
             :class="imgClass"
             class="sprite-image"
             :viewBox="viewBox"
             preserveAspectRatio="xMidYMid meet"
             role="img"
             :aria-label="alt">
            <image :href="resolvedImage.url"
                   :x="-resolvedImage.x"
                   :y="-resolvedImage.y"
                   :width="resolvedImage.sheetWidth"
                   :height="resolvedImage.sheetHeight"
                   preserveAspectRatio="none"></image>
        </svg>
        <img v-else-if="resolvedUrl && !failed" :src="resolvedUrl" :alt="alt" :class="imgClass" @error="onError">
        <div v-else :class="placeholderClass"></div>
    `
};
