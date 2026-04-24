import {describe, expect, it} from 'vitest'
import {htmlToBlocks} from '../htmlToBlocks'

const PHOTO_SRC = 'photo.jpg';
const SLIDE_ONE_SRC = 'slide-1.jpg';
const SLIDE_TWO_SRC = 'slide-2.jpg';
const HERO_SRC = 'hero.jpg';
const VIDEO_SRC = 'clip.mp4';
const POSTER_SRC = 'poster.jpg';
const EDIT_ANCHOR = '#edit';
const DELETE_ANCHOR = '#delete';

describe('htmlToBlocks', () => {
    it('parses empty HTML to empty blocks', () => {
        const result = htmlToBlocks('');
        expect(result.blocks).toEqual([])
    });

    it('parses a simple heading', () => {
        const result = htmlToBlocks('<h1>Hello World</h1>');
        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].type).toBe('heading');
        expect(result.blocks[0].props.text).toBe('Hello World');
        expect(result.blocks[0].props.level).toBe(1)
    });

    it('parses heading levels', () => {
        const result = htmlToBlocks('<h3>Sub Title</h3>');
        expect(result.blocks[0].props.level).toBe(3)
    });

    it('parses a paragraph', () => {
        const result = htmlToBlocks('<p>Some text</p>');
        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].type).toBe('paragraph');
        expect(result.blocks[0].props.text).toBe('Some text')
    });

    it('parses classes', () => {
        const result = htmlToBlocks('<div class="container mt-4 bg-light"></div>');
        expect(result.blocks[0].classes).toEqual(['container', 'mt-4', 'bg-light'])
    });

    it('parses inline styles', () => {
        const result = htmlToBlocks('<div style="background-color: red; font-size: 16px"></div>');
        expect(result.blocks[0].styles.backgroundColor).toBe('red');
        expect(result.blocks[0].styles.fontSize).toBe('16px')
    });

    it('parses nested elements', () => {
        const result = htmlToBlocks('<div class="row"><div class="col"><p>Nested</p></div></div>');
        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].type).toBe('container');
        expect(result.blocks[0].children).toHaveLength(1);
        expect(result.blocks[0].children[0].children).toHaveLength(1);
        expect(result.blocks[0].children[0].children[0].type).toBe('paragraph')
    });

    it('parses an image', () => {
        const result = htmlToBlocks(`<img src="${PHOTO_SRC}" alt="A photo" />`);
        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].type).toBe('image');
        expect(result.blocks[0].props.src).toBe(PHOTO_SRC);
        expect(result.blocks[0].props.alt).toBe('A photo')
    });

    it('parses a link', () => {
        const result = htmlToBlocks('<a href="https://example.com" target="_blank">Visit</a>');
        expect(result.blocks[0].type).toBe('link');
        expect(result.blocks[0].props.href).toBe('https://example.com');
        expect(result.blocks[0].props.target).toBe('_blank');
        expect(result.blocks[0].props.text).toBe('Visit')
    });

    it('parses a button', () => {
        const result = htmlToBlocks('<button class="btn btn-primary">Click Me</button>');
        expect(result.blocks[0].type).toBe('button');
        expect(result.blocks[0].props.text).toBe('Click Me');
        expect(result.blocks[0].classes).toEqual(['btn', 'btn-primary'])
    });

    it('parses a list', () => {
        const result = htmlToBlocks('<ul><li>Alpha</li><li>Beta</li></ul>');
        expect(result.blocks[0].type).toBe('list');
        expect(result.blocks[0].props.items).toEqual(['Alpha', 'Beta'])
    });

    it('parses an ordered list', () => {
        const result = htmlToBlocks('<ol><li>First</li><li>Second</li></ol>');
        expect(result.blocks[0].type).toBe('list');
        expect(result.blocks[0].props.ordered).toBe(true)
    });

    it('preserves data-block-id if present', () => {
        const result = htmlToBlocks('<div data-block-id="blk_123"></div>');
        expect(result.blocks[0].id).toBe('blk_123')
    });

    it('generates new IDs when data-block-id is absent', () => {
        const result = htmlToBlocks('<div></div>');
        expect(result.blocks[0].id).toBeTruthy();
        expect(result.blocks[0].id).toMatch(/^blk_/)
    });

    it('skips script and style tags', () => {
        const result = htmlToBlocks('<script>alert("xss")</script><style>body{}</style><p>Keep</p>');
        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].type).toBe('paragraph')
    });

    it('wraps orphan text in paragraph blocks', () => {
        const result = htmlToBlocks('Just some text');
        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].type).toBe('paragraph');
        expect(result.blocks[0].props.text).toBe('Just some text')
    });

    it('parses multiple top-level elements', () => {
        const result = htmlToBlocks('<h1>Title</h1><p>Body</p><hr />');
        expect(result.blocks).toHaveLength(3);
        expect(result.blocks[0].type).toBe('heading');
        expect(result.blocks[1].type).toBe('paragraph');
        expect(result.blocks[2].type).toBe('hr')
    });

    it('parses semantic tags correctly', () => {
        const result = htmlToBlocks('<section><nav></nav><article></article><footer></footer></section>');
        expect(result.blocks[0].type).toBe('section');
        expect(result.blocks[0].children[0].type).toBe('navbar');
        expect(result.blocks[0].children[1].type).toBe('article');
        expect(result.blocks[0].children[2].type).toBe('footer')
    });

    it('handles malformed HTML gracefully', () => {
        const result = htmlToBlocks('<div><p>Unclosed');
        // DOMParser auto-closes tags, so this should still produce blocks
        expect(result.blocks.length).toBeGreaterThanOrEqual(1)
    });

    it('returns diagnostics array (empty for valid HTML)', () => {
        const result = htmlToBlocks('<p>Valid</p>');
        expect(result.diagnostics).toEqual([])
    });

    it('sets tag override when tag differs from default', () => {
        const result = htmlToBlocks('<section></section>');
        // section's default tag IS 'section', so tag should be undefined
        expect(result.blocks[0].tag).toBeUndefined();

        const result2 = htmlToBlocks('<main></main>');
        // 'main' isn't in TAG_TO_TYPE, so type='container', default tag='div', tag override='main'
        expect(result2.blocks[0].type).toBe('container');
        expect(result2.blocks[0].tag).toBe('main')
    });

    it('parses bootstrap checkbox markup as a checkbox block', () => {
        const result = htmlToBlocks(`
      <div class="form-check" data-block-id="blk_check_1">
        <input class="form-check-input" type="checkbox" id="blk_check_1" name="consent" checked>
        <label class="form-check-label" for="blk_check_1">
          Check me
        </label>
      </div>
    `);

        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].id).toBe('blk_check_1');
        expect(result.blocks[0].type).toBe('checkbox');
        expect(result.blocks[0].classes).toEqual(['form-check-input']);
        expect(result.blocks[0].props.label).toBe('Check me');
        expect(result.blocks[0].props.name).toBe('consent');
        expect(result.blocks[0].props.checked).toBe(true)
    });

    it('preserves checkbox blocks inside bootstrap tab panes', () => {
        const result = htmlToBlocks(`
      <div id="tabs-demo">
        <ul class="nav nav-tabs" id="tabs-demo" role="tablist">
          <li class="nav-item" role="presentation">
            <button class="nav-link active" id="tabs-demo-tab-0" data-bs-toggle="tab" data-bs-target="#tabs-demo-content-0" type="button" role="tab">
              Home
            </button>
          </li>
        </ul>
        <div class="tab-content" id="tabs-demoContent">
          <div class="tab-pane fade show active" id="tabs-demo-content-0" role="tabpanel">
            <p>Home tab content.</p>
            <div class="form-check">
              <input class="form-check-input" type="checkbox" id="blk_check_2">
              <label class="form-check-label" for="blk_check_2">Check me</label>
            </div>
          </div>
        </div>
      </div>
    `);

        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].type).toBe('tabs');
        const tabs = result.blocks[0].props.tabs as Array<{ blocks: Array<{ type: string }> }>;
        expect(tabs).toHaveLength(1);
        expect(tabs[0].blocks.map((block) => block.type)).toEqual(['paragraph', 'checkbox'])
    });

    it('parses empty icon placeholders as icon blocks', () => {
        const result = htmlToBlocks(`
      <span
        data-amagon-component="icon"
        data-amagon-icon-class=""
        style="display: inline-flex; align-items: center; justify-content: center; line-height: 1; min-width: 2rem; min-height: 2rem; border: 2px dashed #dee2e6; border-radius: 0.375rem; color: #6c757d"
        title="No icon selected"
      >☆</span>
    `);

        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].type).toBe('icon');
        expect(result.blocks[0].props.iconClass).toBe('')
    });

    it('preserves icon blocks inside bootstrap tab panes', () => {
        const result = htmlToBlocks(`
      <div id="tabs-demo">
        <ul class="nav nav-tabs" id="tabs-demo" role="tablist">
          <li class="nav-item" role="presentation">
            <button class="nav-link active" id="tabs-demo-tab-0" data-bs-toggle="tab" data-bs-target="#tabs-demo-content-0" type="button" role="tab">
              Home
            </button>
          </li>
        </ul>
        <div class="tab-content" id="tabs-demoContent">
          <div class="tab-pane fade show active" id="tabs-demo-content-0" role="tabpanel">
            <p>Profile tab content.</p>
            <span
              data-amagon-component="icon"
              data-amagon-icon-class=""
              style="display: inline-flex; align-items: center; justify-content: center; line-height: 1; min-width: 2rem; min-height: 2rem; border: 2px dashed #dee2e6; border-radius: 0.375rem; color: #6c757d"
              title="No icon selected"
            >☆</span>
            <img class="img-fluid" src="app-media://project-asset/assets/web-1774176696305.jpg" alt="Image" />
          </div>
        </div>
      </div>
    `);

        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].type).toBe('tabs');
        const tabs = result.blocks[0].props.tabs as Array<{ blocks: Array<{ type: string }> }>;
        expect(tabs).toHaveLength(1);
        expect(tabs[0].blocks.map((block) => block.type)).toEqual(['paragraph', 'icon', 'image'])
    });

    it('parses wrapped bootstrap input controls as input blocks', () => {
        const result = htmlToBlocks(`
      <div class="mb-3">
        <label for="email-field" class="form-label">Email Address</label>
        <input class="form-control mb-3" id="email-field" type="email" name="email" placeholder="name@example.com">
      </div>
    `);

        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].type).toBe('input');
        expect(result.blocks[0].classes).toEqual(['form-control', 'mb-3']);
        expect(result.blocks[0].props.type).toBe('email');
        expect(result.blocks[0].props.name).toBe('email');
        expect(result.blocks[0].props.placeholder).toBe('name@example.com');
        expect(result.blocks[0].props.label).toBe('Email Address')
    });

    it('parses bootstrap carousel markup as a carousel block', () => {
        const result = htmlToBlocks(`
      <div id="hero-carousel" class="carousel slide carousel-fade">
        <div class="carousel-indicators">
          <button type="button" data-bs-target="#hero-carousel" data-bs-slide-to="0" class="active"></button>
        </div>
        <div class="carousel-inner">
          <div class="carousel-item active">
            <img src="${SLIDE_ONE_SRC}" class="d-block w-100" alt="Slide 1">
            <div class="carousel-caption d-none d-md-block"><h5>First Slide</h5></div>
          </div>
          <div class="carousel-item">
            <img src="${SLIDE_TWO_SRC}" class="d-block w-100" alt="Slide 2">
          </div>
        </div>
      </div>
    `);

        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].type).toBe('carousel');
        expect(result.blocks[0].props.id).toBe('hero-carousel');
        expect(result.blocks[0].props.slides).toEqual([
            {src: SLIDE_ONE_SRC, alt: 'Slide 1', caption: 'First Slide'},
            {src: SLIDE_TWO_SRC, alt: 'Slide 2', caption: ''}
        ]);
        expect(result.blocks[0].props.transition).toBe('fade');
        expect(result.blocks[0].props.fade).toBe(true)
    });

    it('parses bootstrap carousel fixed image height', () => {
        const result = htmlToBlocks(`
      <div id="hero-carousel" class="carousel slide">
        <div class="carousel-inner">
          <div class="carousel-item active">
            <img src="${SLIDE_ONE_SRC}" class="d-block w-100" alt="Slide 1" style="height: 320px; object-fit: cover;">
          </div>
          <div class="carousel-item">
            <img src="${SLIDE_TWO_SRC}" class="d-block w-100" alt="Slide 2" style="height: 320px; object-fit: cover;">
          </div>
        </div>
      </div>
    `);

        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].type).toBe('carousel');
        expect(result.blocks[0].props.imageHeightMode).toBe('fixed');
        expect(result.blocks[0].props.imageHeight).toBe('320px')
    });

    it('parses bootstrap modal trigger and dialog as a single modal block', () => {
        const result = htmlToBlocks(`
      <button type="button" class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#launch-modal">
        Launch Modal
      </button>
      <div class="modal fade" id="launch-modal" tabindex="-1" aria-labelledby="launch-modalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h1 class="modal-title fs-5" id="launch-modalLabel">Example Modal</h1>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <p>Modal body text goes here.</p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              <button type="button" class="btn btn-primary">Save changes</button>
            </div>
          </div>
        </div>
      </div>
    `);

        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].type).toBe('modal');
        expect(result.blocks[0].props.id).toBe('launch-modal');
        expect(result.blocks[0].props.buttonText).toBe('Launch Modal');
        expect(result.blocks[0].props.title).toBe('Example Modal');
        expect(result.blocks[0].props.closeButton).toBe(true);
        expect(result.blocks[0].props.footerButtons).toBe(true);
        expect(result.blocks[0].props.size).toBe('modal-lg');
        expect(result.blocks[0].children).toHaveLength(1);
        expect(result.blocks[0].children[0].type).toBe('paragraph')
    });

    it('parses table markup as a table block', () => {
        const result = htmlToBlocks(`
      <div class="table-responsive" data-amagon-table="true" data-table-striped="true" data-table-bordered="true" data-table-hover="true" data-table-responsive="true" data-table-size="sm" data-table-variant="dark">
        <table class="table table-striped table-bordered table-hover table-sm table-dark" data-amagon-table-inner="true">
          <thead>
            <tr><th>Name</th><th>Role</th></tr>
          </thead>
          <tbody>
            <tr><td>Jane</td><td>Admin</td></tr>
            <tr><td>John</td><td>Editor</td></tr>
          </tbody>
        </table>
      </div>
    `);

        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].type).toBe('table');
        expect(result.blocks[0].props.headers).toEqual(['Name', 'Role']);
        expect(result.blocks[0].props.rows).toEqual([
            ['Jane', 'Admin'],
            ['John', 'Editor']
        ]);
        expect(result.blocks[0].props.striped).toBe(true);
        expect(result.blocks[0].props.bordered).toBe(true);
        expect(result.blocks[0].props.hover).toBe(true);
        expect(result.blocks[0].props.responsive).toBe(true);
        expect(result.blocks[0].props.size).toBe('sm');
        expect(result.blocks[0].props.variant).toBe('dark')
    });

    it('parses dropdown markup as a dropdown block', () => {
        const result = htmlToBlocks(`
      <div class="btn-group dropdown" data-amagon-dropdown="true" data-dropdown-variant="secondary" data-dropdown-size="default" data-dropdown-direction="down" data-dropdown-split="true">
        <button type="button" class="btn btn-secondary">Actions</button>
        <button type="button" class="btn btn-secondary dropdown-toggle dropdown-toggle-split" data-bs-toggle="dropdown"></button>
        <ul class="dropdown-menu">
          <li><a class="dropdown-item" href="${EDIT_ANCHOR}">Edit</a></li>
          <li><hr class="dropdown-divider"></li>
          <li><a class="dropdown-item disabled" href="${DELETE_ANCHOR}" tabindex="-1" aria-disabled="true">Delete</a></li>
        </ul>
      </div>
    `);

        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].type).toBe('dropdown');
        expect(result.blocks[0].props.label).toBe('Actions');
        expect(result.blocks[0].props.variant).toBe('secondary');
        expect(result.blocks[0].props.split).toBe(true);
        expect(result.blocks[0].props.items).toEqual([
            {label: 'Edit', href: '#edit', divider: false, disabled: false},
            {label: '', href: '#', divider: true, disabled: false},
            {label: 'Delete', href: '#delete', divider: false, disabled: true}
        ])
    });

    it('parses offcanvas markup as an offcanvas block', () => {
        const result = htmlToBlocks(`
      <div data-amagon-offcanvas="true" data-offcanvas-placement="end" data-offcanvas-backdrop="false" data-offcanvas-scroll="true">
        <button class="btn btn-primary" type="button" data-bs-toggle="offcanvas" data-bs-target="#settings-panel">Toggle panel</button>
        <div class="offcanvas offcanvas-end" tabindex="-1" id="settings-panel" aria-labelledby="settings-panelLabel" data-bs-backdrop="false" data-bs-scroll="true">
          <div class="offcanvas-header">
            <h5 class="offcanvas-title" id="settings-panelLabel">Settings</h5>
          </div>
          <div class="offcanvas-body">
            <p>Panel content</p>
          </div>
        </div>
      </div>
    `);

        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].type).toBe('offcanvas');
        expect(result.blocks[0].props.title).toBe('Settings');
        expect(result.blocks[0].props.placement).toBe('end');
        expect(result.blocks[0].props.backdrop).toBe(false);
        expect(result.blocks[0].props.scroll).toBe(true);
        expect(result.blocks[0].props.id).toBe('settings-panel');
        expect(result.blocks[0].children).toHaveLength(1);
        expect(result.blocks[0].children[0].type).toBe('paragraph')
    });

    it('parses card markup as a card block', () => {
        const result = htmlToBlocks(`
      <div class="card text-bg-primary" data-amagon-card="true" data-card-variant="primary" data-card-outline="false" data-card-image-position="top">
        <div class="card-header" data-card-header="true">Header</div>
        <img src="https://example.com/card.jpg" class="card-img-top" alt="Card image" data-card-image="true">
        <div class="card-body" data-card-body="true">
          <div data-card-content="true">
            <h5 class="card-title">Card title</h5>
            <h6 class="card-subtitle mb-2 text-body-secondary">Card subtitle</h6>
            <p class="card-text">Card body copy</p>
          </div>
        </div>
        <div class="card-footer" data-card-footer="true">Footer</div>
      </div>
    `);

        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].type).toBe('card');
        expect(result.blocks[0].props.title).toBe('Card title');
        expect(result.blocks[0].props.subtitle).toBe('Card subtitle');
        expect(result.blocks[0].props.text).toBe('Card body copy');
        expect(result.blocks[0].props.imageUrl).toBe('https://example.com/card.jpg');
        expect(result.blocks[0].props.imagePosition).toBe('top');
        expect(result.blocks[0].props.headerText).toBe('Header');
        expect(result.blocks[0].props.footerText).toBe('Footer');
        expect(result.blocks[0].props.variant).toBe('primary');
        expect(result.blocks[0].props.outline).toBe(false)
    });

    it('parses phase 3 enhanced block markup', () => {
        const result = htmlToBlocks(`
      <figure class="position-relative">
        <a href="${HERO_SRC}" data-amagon-lightbox="true">
          <img class="img-fluid object-cover" src="${HERO_SRC}" alt="Hero" loading="lazy" style="aspect-ratio: 16 / 9; object-fit: cover" />
        </a>
        <figcaption class="position-absolute bottom-0 start-0 end-0">Hero caption</figcaption>
      </figure>
      <div class="ratio ratio-21x9" data-amagon-media-ratio="21:9">
        <video class="w-100 h-100" src="${VIDEO_SRC}" controls autoplay loop muted preload="metadata" poster="${POSTER_SRC}"></video>
      </div>
      <button class="btn btn-outline-primary w-100 d-block"
        data-amagon-button-variant="primary"
        data-amagon-button-size=""
        data-amagon-button-outline="true"
        data-amagon-button-block="true"
        data-amagon-button-loading="true"
        data-amagon-button-loading-text="Saving..."
        disabled>
        <span class="spinner-border spinner-border-sm"></span>
        <span class="amagon-btn-label">Saving...</span>
      </button>
      <div class="mb-3">
        <label for="email-field" class="form-label">Email</label>
        <div class="input-group">
          <span class="input-group-text">@</span>
          <input class="form-control is-invalid" id="email-field" type="email" />
          <span class="input-group-text">.com</span>
        </div>
        <div class="invalid-feedback d-block">Invalid email</div>
        <div class="form-text">Use your work email</div>
      </div>
      <div class="form-check form-switch form-check-inline">
        <input class="form-check-input" type="checkbox" id="beta" checked>
        <label class="form-check-label" for="beta">Enable beta</label>
      </div>
      <div class="mb-3">
        <label for="country">Country</label>
        <select class="form-select" id="country" multiple size="5">
          <optgroup label="Asia">
            <option value="jp">Japan</option>
            <option value="ph">Philippines</option>
          </optgroup>
        </select>
      </div>
      <div class="bg-dark text-light p-3 rounded position-relative"
        data-amagon-code-block="true"
        data-code-language="javascript"
        data-code-show-line-numbers="true"
        data-code-filename="main.ts"
        data-code-copy-button="true"
        data-code-content="const%20x%20%3D%201%3B">
        <pre><code class="hljs language-javascript" data-amagon-code-source>const x = 1;</code></pre>
      </div>
      <span class="fa-xl fa-spin fa-fw" style="color: #ff9900;" data-amagon-component="icon" data-amagon-icon-class="lucide:loader"></span>
      <div class="ratio ratio-4x3" data-amagon-embed-ratio="4:3">
        <iframe class="w-100 border" src="https://example.com/embed" title="Embed" allowfullscreen loading="lazy"></iframe>
      </div>
    `);

        expect(result.blocks.map((block) => block.type)).toEqual([
            'image',
            'video',
            'button',
            'input',
            'checkbox',
            'select',
            'code-block',
            'icon',
            'iframe'
        ]);

        expect(result.blocks[0].props.caption).toBe('Hero caption');
        expect(result.blocks[0].props.lightbox).toBe(true);
        expect(result.blocks[1].props.aspectRatio).toBe('21:9');
        expect(result.blocks[2].props.loading).toBe(true);
        expect(result.blocks[2].props.outline).toBe(true);
        expect(result.blocks[3].props.prepend).toBe('@');
        expect(result.blocks[3].props.append).toBe('.com');
        expect(result.blocks[3].props.validationState).toBe('invalid');
        expect(result.blocks[4].props.switch).toBe(true);
        expect(result.blocks[4].props.inline).toBe(true);
        expect(result.blocks[5].props.optgroups).toBe(true);
        expect(Array.isArray(result.blocks[5].props.items)).toBe(true);
        expect(result.blocks[6].props.showLineNumbers).toBe(true);
        expect(result.blocks[6].props.filename).toBe('main.ts');
        expect(result.blocks[7].props.spin).toBe(true);
        expect(result.blocks[7].props.fixedWidth).toBe(true);
        expect(result.blocks[8].props.aspectRatio).toBe('4:3');
        expect(result.blocks[8].props.allowFullscreen).toBe(true)
    });

    it('parses phase 4 layout and component block markup', () => {
        // heading with anchorId
        const headingResult = htmlToBlocks('<h2 id="about-us">About Us</h2>');
        expect(headingResult.blocks[0].type).toBe('heading');
        expect(headingResult.blocks[0].props.anchorId).toBe('about-us');
        expect(headingResult.blocks[0].props.level).toBe(2);

        // heading with decorative classes
        const decorResult = htmlToBlocks('<h1 class="amagon-heading-underline">Title</h1>');
        expect(decorResult.blocks[0].props.decorative).toBe('underline');

        const gradResult = htmlToBlocks('<h1 class="amagon-heading-gradient-underline">Title</h1>');
        expect(gradResult.blocks[0].props.decorative).toBe('gradient-underline');

        // paragraph with dropCap
        const dropCapResult = htmlToBlocks('<p data-drop-cap="true" class="amagon-drop-cap">Story text</p>');
        expect(dropCapResult.blocks[0].type).toBe('paragraph');
        expect(dropCapResult.blocks[0].props.dropCap).toBe(true);

        // paragraph with column-count style
        const colsResult = htmlToBlocks('<p style="column-count: 3;">Multi col text</p>');
        expect(colsResult.blocks[0].props.columns).toBe('3');

        // paragraph with lead class
        const leadResult = htmlToBlocks('<p class="lead">Lead text</p>');
        expect(leadResult.blocks[0].props.lead).toBe(true);

        // list with horizontal
        const listResult = htmlToBlocks('<ul class="list-inline"><li class="list-inline-item">A</li><li class="list-inline-item">B</li></ul>');
        expect(listResult.blocks[0].type).toBe('list');
        expect(listResult.blocks[0].props.horizontal).toBe(true)
    });

    it('parses blockquote with author and source from footer', () => {
        const html = `<blockquote class="blockquote">Quote text<footer class="blockquote-footer mt-2">Jane Doe, <cite>Famous Book</cite></footer></blockquote>`;
        const result = htmlToBlocks(html);
        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].type).toBe('blockquote');
        expect(result.blocks[0].props.text).toBe('Quote text');
        expect(result.blocks[0].props.author).toBe('Jane Doe');
        expect(result.blocks[0].props.source).toBe('Famous Book')
    });

    it('parses blockquote with decorative class', () => {
        const html = `<blockquote class="blockquote amagon-bq-border-left">Some quote</blockquote>`;
        const result = htmlToBlocks(html);
        expect(result.blocks[0].type).toBe('blockquote');
        expect(result.blocks[0].props.decorative).toBe('border-left');
        expect(result.blocks[0].classes).not.toContain('amagon-bq-border-left')
    });

    it('parses link with data-block-type="link" and btn class as link (not button)', () => {
        const html = `<a class="btn btn-primary" href="/start" data-block-type="link">Get Started</a>`;
        const result = htmlToBlocks(html);
        expect(result.blocks).toHaveLength(1);
        expect(result.blocks[0].type).toBe('link');
        expect(result.blocks[0].props.button).toBe(true);
        expect(result.blocks[0].props.href).toBe('/start');
        expect(result.blocks[0].props.text).toBe('Get Started')
    });

    it('parses link with newTab (target=_blank)', () => {
        const html = `<a class="btn btn-secondary" href="/page" target="_blank" rel="noopener noreferrer" data-block-type="link">External</a>`;
        const result = htmlToBlocks(html);
        expect(result.blocks[0].type).toBe('link');
        expect(result.blocks[0].props.newTab).toBe(true);
        expect(result.blocks[0].props.href).toBe('/page')
    })
});
