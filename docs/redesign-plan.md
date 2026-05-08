# Redesign Plan — dotclaude

> Bắt đầu: 2026-05-07
>
> Bối cảnh: skeleton hiện tại (`packages/`, `scripts/`) là do Claude session trước
> setup nhanh để có structure, **chưa được verify**. Session này sẽ redesign lại
> repo structure + installer dựa trên yêu cầu mới của owner. Skeleton hiện tại
> được giữ nguyên cho đến khi có plan rõ ràng.
>
> Quy trình:
> 1. Thu thập yêu cầu/ý tưởng từ owner (mục [Requirements](#requirements)).
> 2. Đặt câu hỏi làm rõ trước khi generate plan thật.
> 3. Generate redesign plan (mục [Plan](#plan)) sau khi requirements đủ rõ.
> 4. Giải quyết các risks + open questions tồn đọng dưới đây trong quá trình redesign.

---

## 1. Risks tồn đọng từ skeleton hiện tại

Cần xử lý hoặc cố ý chấp nhận khi redesign:

### R1 — Destructive `rm -rf` trong installer
- **File**: `scripts/install-preset.sh` (~line 100, 105)
- **Hành vi**: `rm -rf '$dst'` chạy trước mỗi symlink/copy ECC skill
- **Tình huống xấu**: nếu awk parser resolve sai `$dst` → `$dst` rỗng/sai → có thể xóa nhầm thư mục ngoài ý muốn. Hiện được bảo vệ một phần bởi `set -euo pipefail`.
- **Tình huống xấu 2**: symlink target mặc định là `$(pwd)/.claude` → user **bắt buộc** phải `cd` vào project repo trước khi chạy. Quên thì symlink trỏ sai.
- **Cần khi redesign**: defensive guards (verify `$dst` non-empty + nằm trong target dir trước khi xóa); explicit `--target` thay vì rely vào CWD.

### R2 — Awk parser fragile
- **File**: cả `install-user.sh` và `install-preset.sh`
- **Hành vi**: parse YAML bằng awk với indentation cứng (2-space section, 4-space key)
- **Tình huống xấu**: ai chỉnh tay YAML sai indent → parser trả về chuỗi rỗng → script exit "ECC local_path not configured", hoặc tệ hơn là trả sai value mà script vẫn chạy.
- **Tiềm ẩn**: hàm `run()` dùng `eval "$@"` — shell injection nếu path chứa ký tự đặc biệt. Hiện safe vì path hardcode trong YAML.
- **Cần khi redesign**: quyết định chiến lược parser — giữ awk (self-contained), hay accept thêm dependency (`yq`, Python, Node) để có schema validation.

### R3 — `rsync -a` không xoá file cũ
- **File**: `install-user.sh` (overlay personal files vào `~/.claude/`)
- **Hành vi**: `rsync -a` chỉ thêm/update, không có `--delete`
- **Tình huống xấu**: rename/xóa file trong `packages/user/agents/` → file cũ vẫn tồn tại ở `~/.claude/agents/`, gây drift lâu dần.
- **Cần khi redesign**: chiến lược cleanup — `--delete` (nguy hiểm với mixed content), hay manifest-based tracking, hay symlink toàn bộ user layer thay vì rsync.

### R4 — ECC installer là black box, không có version pinning thực sự
- **File**: `dependencies.yaml`
- **Hành vi**: trường `pinned_commit` cho cả 4 source vẫn là `null`. Script đọc `local_path` để gọi `$ECC_DIR/install.sh --target claude --modules <ids>` nhưng không verify commit ECC đang ở đúng version mong đợi.
- **Tình huống xấu**: ECC upstream thay đổi flag installer → dotclaude scripts break im lặng. Hoặc submodule bị bump không ý thức được.
- **Cần khi redesign**: cơ chế pin (lockfile hoặc enforce check submodule SHA) + cách update/refresh.

### R5 — Preset CLAUDE.md template chỉ copy nếu chưa tồn tại
- **File**: `install-preset.sh`
- **Hành vi**: skip `CLAUDE.md` nếu project đã có
- **Tình huống xấu**: project đã có CLAUDE.md sơ sài → user không biết template ECC có gì hay → phải merge thủ công, dễ bỏ sót.
- **Cần khi redesign**: chiến lược template — copy as `.example`, hoặc merge sections, hoặc warn explicit.

### R6 — Symlink mặc định nhưng vendor/ECC ở local path
- Symlink trỏ vào `vendor/everything-claude-code/skills/<id>/` của repo dotclaude. Nếu user clone dotclaude ở máy khác có path khác, hoặc move repo, symlink bị broken.
- **Cần khi redesign**: tài liệu rõ symlink là absolute path đến repo dotclaude; rerun installer khi move repo.

---

## 2. Open questions tồn đọng

Câu hỏi chưa có lời đáp trong skeleton/docs hiện tại:

### Q1 — ECC installer API thực sự là gì?
Script gọi `./install.sh --target claude --modules <ids>` nhưng dotclaude không có docs về flag này. Cần verify với `vendor/everything-claude-code/install.sh` (đọc trực tiếp source) trước khi tin tưởng.

### Q2 — Personal overlays sẽ chứa gì?
`packages/user/{rules,agents,commands,hooks,skills}/` đang rỗng. Convention cá nhân của owner chưa được viết ra — đây là phần "tại sao có repo này" mà skeleton chưa trả lời.

### Q3 — Settings.json strategy
ECC modules có thể ship `settings.json` snippet. User-level `~/.claude/settings.json` đã có (xem owner setup hiện tại). Chưa quyết định: overlay (overwrite), merge JSON, hay tách `settings.local.json`?

### Q4 — Preset inheritance (`extends:`)
`docs/architecture.md` ghi nhận tương lai: ví dụ `nestjs-prisma extends typescript-fullstack`. Chưa có schema, chưa implement.

### Q5 — Lockfile cho reproducible install
`dependencies.lock.yaml` được nhắc trong CLAUDE.md TODO nhưng chưa thiết kế. Format gì? Ai generate? CI verify?

### Q6 — CI / validation
- Validate `deps.yaml` references có thực sự tồn tại trong ECC manifest?
- Lint markdown frontmatter của agent/skill?
- Test installer trong sandbox?

### Q7 — Distribution / multi-machine
- Owner dùng repo này trên nhiều máy → cách bootstrap nhanh trên máy mới?
- Có cần `bootstrap.sh` không (clone + submodule init + install user)?

### Q8 — Update workflow
- `scripts/update.sh` chưa có. Update nghĩa là gì: `git submodule update --remote` rồi reinstall? Có cần diff trước khi apply?

---

## 3. Requirements

> Sẽ fill dần khi owner đưa yêu cầu/ý tưởng. Mỗi requirement nên ghi: **what**, **why**, **constraint** (nếu có).

### REQ-1 — Bộ "claudekit" core đầy đủ
- **What**: một bộ kit đầy đủ gồm `agents/`, `skills/`, `rules/`, `commands/`, `hooks/`, ... — đóng vai trò core của repo (tương đương ECC nhưng do owner kiểm soát).
- **Source**: tổng hợp từ nhiều nguồn upstream (ECC, `anthropics/skills`, anthropic-cookbook, ...) — có thể là clone nguyên hoặc clone + chỉnh sửa theo mong muốn cá nhân.
- **Provenance**: mỗi component có file ghi chú nguồn riêng (upstream URL, commit, đã modify hay chưa, ...).
- **Khác biệt với skeleton hiện tại**: skeleton hiện chỉ wrap ECC qua submodule + installer. Yêu cầu mới là **tự mình sở hữu** bộ kit, không phụ thuộc runtime vào ECC.

### REQ-2 — Presets là pure manifest (md/json, prefer json)
- **What**: presets KHÔNG chứa code component, chỉ là file mô tả "preset X dùng các component nào trong core".
- **Trục phân loại**: theo framework (vd Next.js, Django), theo core baseline (cross-stack), theo mục đích cụ thể của từng loại project.
- **Format**: prefer JSON cho machine-readability của installer; markdown có thể song song cho human docs.
- **Khác biệt với skeleton hiện tại**: skeleton hiện preset có `skills/` directory riêng (dù đang rỗng). Yêu cầu mới là **preset chỉ trỏ vào core**, không tự chứa.

### REQ-3 — `private/` folder ở mỗi phần (gitignored)
- **What**: tại mỗi cấp phù hợp (core/, presets/, có thể cả từng loại component), có folder `private/` chứa thứ riêng tư của owner — project-specific, company-specific, secrets, internal conventions.
- **Constraint**: `private/` ignore khỏi git để dùng local mà không leak khi push public.
- **Mục tiêu**: dùng được local đầy đủ tính năng + an toàn khi repo public hoặc share.

### REQ-4 — Install script chạy theo preset, multi-level
- **What**: scripts đọc preset (md/json, prefer json) và install các component tương ứng vào target phù hợp.
- **Levels**: user-level (`~/.claude/`), repo-level (`<project>/.claude/`), và có thể các level khác theo Claude convention.
- **Constraint**: tuân theo Claude Code conventions chính thức (đường dẫn `~/.claude/agents/*.md`, `~/.claude/skills/<name>/SKILL.md`, `~/.claude/commands/*.md`, format frontmatter, hook config trong `settings.json`...).

### REQ-5 — Marketplace + plugin theo preset
- **What**: hỗ trợ Claude Code marketplace + plugin model — đóng gói preset thành plugin để cài qua marketplace, không chỉ qua script local.
- **Goal**: 1 preset có thể publish thành 1 plugin package, người khác (hoặc owner ở máy khác) cài qua `/plugin install ...` theo flow chính thức của Claude Code.

---

## 4. Clarifying questions cho owner

> Đã tách sang [clarifying-questions.md](./clarifying-questions.md) để dễ track trạng
> thái từng CQ (`pending`/`asking`/`answered`). File đó là source-of-truth, file này
> chỉ giữ pointer.
>
> Tóm tắt: 9 nhóm CQ-1 → CQ-9. Khi 1 CQ answered, decision được sync ngược về đây
> (mục 5 — Plan) khi generate plan.

<details>
<summary>Snapshot 9 CQ groups (chi tiết xem file riêng)</summary>

### CQ-1 — Layout của core (REQ-1)

**a)** Tên + vị trí của core ở root: `core/`, `kit/`, `claudekit/`, hay `packages/core/`?

**b)** Cấu trúc bên trong core — chọn 1 trong các kiểu:
  - **Type-first** (ECC style): `core/agents/`, `core/skills/`, `core/commands/`, `core/hooks/`, `core/rules/` — phẳng theo loại component.
  - **Domain-first**: `core/web/{agents,skills}/`, `core/python/{agents,skills}/` — group theo domain trước, loại sau.
  - **Hybrid**: top-level type, sub-folder domain bên trong (vd `core/skills/web/`, `core/skills/python/`).

**c)** Khi vendor 1 component từ ECC: copy file vào `core/` rồi gắn metadata, hay giữ submodule và symlink? Owner muốn **tự sở hữu nội dung** → khả năng cao là copy vào, đúng không?

**d)** Khi modify một component clone từ upstream: dùng patch file riêng + apply mỗi lần update, hay edit thẳng file rồi lưu diff trong metadata?

### CQ-2 — Provenance metadata format (REQ-1)

Chọn 1 trong:
- **Per-file frontmatter**: thêm field `source:` vào YAML frontmatter có sẵn của agent/skill/command. Ưu: cùng file. Nhược: chỉ work cho file md có frontmatter.
- **Sidecar file**: mỗi component có file `<name>.source.json` (hoặc `.source.md`) cạnh nó. Ưu: format thống nhất, cover cả file không có frontmatter (hooks, json). Nhược: thêm file.
- **Manifest tập trung**: 1 file `core/PROVENANCE.json` (hoặc `.yaml`) liệt kê toàn bộ. Ưu: 1 chỗ scan. Nhược: dễ drift khi sửa file mà quên update manifest.

Owner ghi "**file ghi chú nguồn riêng biệt cho từng phần**" → nghiêng về sidecar hoặc per-file frontmatter. Xác nhận?

Cần fields gì? Đề xuất tối thiểu: `source_repo`, `source_commit`, `source_path`, `imported_at`, `modified` (bool), `modifications` (mô tả ngắn nếu modified).

### CQ-3 — Preset format (REQ-2)

**a)** Schema JSON đề xuất:
```json
{
  "name": "typescript-fullstack",
  "kind": "framework | core | purpose",
  "description": "...",
  "extends": ["base-typescript"],
  "components": {
    "agents": ["code-reviewer", "tdd-guide"],
    "skills": ["coding-standards", "frontend-patterns"],
    "commands": [...],
    "hooks": [...],
    "rules": [...]
  },
  "settings": { "snippet trộn vào settings.json": "..." }
}
```
OK? Cần thêm/bớt field gì?

**b)** Có muốn implement `extends:` ngay đợt redesign này không, hay để Phase 2?

**c)** Trục `framework | core | purpose` đặt ở đâu: thư mục riêng (`presets/framework/`, `presets/core/`, `presets/purpose/`), hay flat + dựa vào field `kind`?

**d)** Markdown song song với JSON để làm gì — chỉ docs (README per preset), hay cũng readable bởi installer?

### CQ-4 — `private/` placement (REQ-3)

**a)** "Mỗi phần" có nghĩa là:
  - Option A: chỉ ở root level → `private/`.
  - Option B: ở mỗi top-level package → `core/private/`, `presets/private/`.
  - Option C: ở mỗi loại component → `core/agents/private/`, `core/skills/private/`, `presets/private/`. Mirror sâu nhất.

  Owner nghiêng về cái nào?

**b)** Cấu trúc trong `private/` mirror cấu trúc public (vd `private/agents/foo.md`), hay tự do?

**c)** Có cần `private.example/` (template gitignored thực, có example commit để hướng dẫn) không?

**d)** Multi-machine: `private/` không track git → bootstrap máy mới thì dùng cách gì (dotfiles repo riêng, 1Password, manual copy)? Có cần repo riêng `dotclaude-private` (private repo) không?

### CQ-5 — Install levels & semantics (REQ-4)

**a)** Levels chính thức theo Claude Code conventions cần support:
  - User: `~/.claude/` (agents, skills, commands, hooks via settings.json)
  - Project: `<repo>/.claude/`
  - Plugin: `~/.claude/plugins/<name>/` (theo plugin model)
  - MCP servers: config trong `~/.claude.json` hoặc `<repo>/.mcp.json`
  
  Tất cả đều support, hay scope hẹp hơn ở phase đầu?

**b)** Install action — pick semantics:
  - **Copy**: an toàn, không phụ thuộc repo dotclaude sau khi cài. Update phải re-run.
  - **Symlink**: live link đến `core/`, edit core → áp dụng ngay. Phụ thuộc absolute path.
  - **Hybrid**: symlink mặc định, `--copy` flag khi muốn standalone.

  Owner muốn cái nào là default?

**c)** Conflict policy khi file đã tồn tại ở target: skip, overwrite, backup-then-overwrite, prompt?

**d)** Idempotent re-run + uninstall: cần ngay phase đầu không?

**e)** Manifest tracking: ghi lại "đã install những gì" ở target (vd `~/.claude/.dotclaude-manifest.json`) để uninstall/update biết phải xóa gì?

### CQ-6 — Marketplace & plugin (REQ-5)

**a)** Marketplace target: official Claude Code plugin marketplace (theo format Anthropic định nghĩa), hay self-hosted marketplace của owner (vd 1 GitHub repo `phantien133/claudekit-marketplace` chứa plugin manifest)?

**b)** Quan hệ preset ↔ plugin:
  - 1-1: mỗi preset = 1 plugin package độc lập?
  - N-1: nhiều preset gộp thành 1 mega plugin?
  - Hai cấp: core plugin + preset plugin extends?

**c)** Plugin packaging: phase này chỉ cần preset → plugin bundle script (`scripts/build-plugin.sh`), hay cần CI/CD publish luôn?

**d)** Phase: marketplace ở phase nào? Owner muốn redesign repo trước rồi mới làm marketplace, hay marketplace là yêu cầu phải support ngay ở thiết kế?

### CQ-7 — Vendor strategy (cross-cutting với REQ-1)

**a)** Sau redesign, có còn giữ `vendor/` submodules không?
  - Giữ ECC submodule như **source để sync**, core là copy có modification → cần workflow merge update từ ECC vào core.
  - Bỏ hoàn toàn submodule, chỉ ghi `source_commit` trong metadata, update là thao tác thủ công 1 lần.

**b)** Nếu giữ submodule cho purpose docs (anthropic-cookbook, anthropic-skills, mcp-servers), có cần move khỏi `vendor/` không (vì không còn là "vendored runtime")?

### CQ-8 — Phase ordering

Owner muốn order nào:
  1. Core layout + provenance trước → presets manifest → install script → marketplace?
  2. Hay scope nhỏ MVP: chỉ core + 1 preset + install user-level, rồi mở rộng?
  3. Hay làm song song?

Cần biết để chia plan thành phases rõ.

### CQ-9 — Migration từ skeleton hiện tại

Skeleton hiện tại (`packages/`, `scripts/`, `vendor/`) sẽ:
  - **Wipe & rewrite**: xóa hết, làm lại từ đầu theo design mới.
  - **Migrate**: giữ những gì còn dùng được, refactor dần.
  - **Branch song song**: skeleton ở `main` cũ, redesign ở branch mới, merge khi ổn.

Owner chọn cách nào?

</details>

---

## 5. Plan

> Generated 2026-05-07 sau khi 9 CQ trong [clarifying-questions.md](./clarifying-questions.md)
> đã chốt. Mỗi quyết định được ghi rõ ở "Decisions log" trong file đó.

### 5.1. Layout đích (sau Phase 1)

```
dotclaude/
├── CLAUDE.md                    # update reflect design mới
├── README.md                    # update
├── dependencies.yaml            # rewrite — list upstream sources + commit pin
├── .gitignore                   # /claudekit/private/, /presets/private/, ...
├── .gitmodules                  # paths cập nhật theo upstream/
│
├── claudekit/                   # core kit, type-first
│   ├── agents/
│   │   ├── code-reviewer.md
│   │   ├── code-reviewer.source.yaml      # provenance sidecar
│   │   ├── web-frontend-reviewer.md       # naming prefix domain
│   │   └── web-frontend-reviewer.source.yaml
│   ├── skills/
│   │   ├── coding-standards/
│   │   │   ├── SKILL.md
│   │   │   └── SOURCE.yaml                # sidecar bên trong, installer EXCLUDE
│   │   └── web-frontend-patterns/
│   │       ├── SKILL.md
│   │       └── SOURCE.yaml
│   ├── commands/
│   │   ├── <name>.md
│   │   └── <name>.source.yaml
│   ├── hooks/
│   │   ├── <name>.sh                      # script thật
│   │   └── <name>.source.yaml
│   ├── rules/
│   │   ├── <name>.md
│   │   └── <name>.source.yaml
│   ├── private/                           # GITIGNORED, mirror trên
│   │   ├── agents/
│   │   ├── skills/
│   │   ├── commands/
│   │   ├── hooks/
│   │   └── rules/
│   └── private.example/                   # TRACKED, skeleton hướng dẫn
│       ├── README.md
│       ├── agents/.gitkeep
│       ├── skills/.gitkeep
│       └── ...
│
├── presets/                     # pure manifest, YAML + MD per preset
│   ├── core/
│   │   ├── personal-baseline.yaml
│   │   └── personal-baseline.md
│   ├── framework/
│   │   ├── nextjs-app.yaml
│   │   └── nextjs-app.md
│   ├── purpose/
│   │   └── ...
│   ├── private/                           # GITIGNORED
│   │   ├── core/
│   │   ├── framework/
│   │   └── purpose/
│   ├── private.example/                   # TRACKED
│   │   ├── README.md
│   │   └── framework/.gitkeep
│   ├── README.md                          # giải thích preset chung
│   └── schema/
│       └── preset.schema.json             # JSON Schema (cross-IDE chuẩn) để validate preset YAML qua header
│
├── plugins/                     # PHASE 4 — build artifacts cho marketplace
│   └── (rỗng cho đến Phase 4)
│
├── upstream/                    # rename từ vendor/ — source để sync + reference
│   ├── everything-claude-code/  (submodule, role: sync source)
│   ├── anthropic-cookbook/      (submodule, role: docs)
│   ├── anthropic-skills/        (submodule, role: docs)
│   └── mcp-servers/             (submodule, role: docs)
│
├── package.json                 # deps: zod, js-yaml, commander, deepmerge, vitest
├── tsconfig.json
├── vitest.config.ts
├── pnpm-lock.yaml               # pnpm lockfile
│
├── scripts/                     # 100% TypeScript, chạy qua tsx (pnpm exec)
│   ├── install.ts               # entry dispatcher: user|project|list|validate
│   ├── install-user.ts          # default symlink
│   ├── install-project.ts       # default copy
│   ├── init-private.ts          # copy private.example → private cho máy mới
│   ├── sync-from-upstream.ts    # diff upstream component
│   ├── clean-backups.ts         # xoá .bak.* cũ
│   ├── lib/
│   │   ├── types.ts             # TypeScript types (Preset, Sidecar, Manifest)
│   │   ├── schema.ts            # zod schemas (runtime validation + types)
│   │   ├── sidecar.ts           # read/write SOURCE.yaml + <name>.source.yaml
│   │   ├── manifest.ts          # read/write .dotclaude-manifest.yaml
│   │   ├── resolver.ts          # extends tree, component lookup public+private
│   │   ├── settings-merge.ts    # deep-merge JSON cho settings_patch
│   │   ├── fs-ops.ts            # symlink/copy/backup helpers
│   │   └── logger.ts            # uniform output (info/warn/error)
│   └── tests/
│       ├── resolver.test.ts
│       ├── settings-merge.test.ts
│       ├── manifest.test.ts
│       └── fixtures/            # preset samples cho test
│
└── docs/
    ├── architecture.md          # update reflect design mới
    ├── redesign-plan.md         # file này
    ├── clarifying-questions.md  # tất cả CQ đã chốt
    ├── PRIVATE.md               # convention private + bootstrap manual
    ├── PROVENANCE.md            # cách dùng sidecar source.yaml
    ├── PRESETS.md               # schema + cách viết preset
    └── INSTALL.md               # cách dùng install scripts
```

### 5.2. Phase 0 — Cleanup skeleton

**Goal**: dọn skeleton chưa verify, chuẩn bị nền cho redesign.

**Steps**:
1. Verify branch sạch, không có thay đổi pending: `git status`.
2. Read kỹ `dependencies.yaml` hiện tại để biết nội dung gì giữ được — chỉ giữ block
   `sources` của ECC + 3 docs, bỏ phần `pinned_commit: null` và schema cũ nếu không
   khớp design mới.
3. `git rm -r packages/`
4. `git rm -r scripts/`
5. `git mv vendor upstream` — git tự update `.gitmodules` nội dung path; verify lại
   `.gitmodules` đường dẫn `path = upstream/...`.
6. Update `.gitignore` thêm:
   ```gitignore
   /claudekit/private/
   /presets/private/
   /plugins/private/
   *.bak.*
   .dotclaude-manifest.yaml    # nếu accidentally commit
   ```
7. Commit `chore: wipe skeleton, prepare redesign` với HEREDOC body giải thích.

**Risks giải quyết**: R1, R2, R3 (xoá installer cũ với `rm -rf` + awk parser).

**Done when**: `tree -L 2` chỉ thấy `upstream/`, `docs/`, `CLAUDE.md`, `dependencies.yaml`.

### 5.2.1. Phase 0.5 — TypeScript toolchain bootstrap

**Goal**: setup pnpm + TS + tsx (CQ-10 revised 2026-05-08) để Phase 1 có nền tảng dùng
ngay.

**Steps**:
1. Verify toolchain: `node --version` (≥20), `pnpm --version` (≥9). Nếu thiếu pnpm:
   `corepack enable` hoặc `brew install pnpm`.
2. Tạo tay `package.json`, `tsconfig.json`, `vitest.config.ts` (không dùng
   `pnpm init` để tránh template thừa).
3. Install deps:
   ```bash
   pnpm add zod zod-to-json-schema js-yaml commander deepmerge
   pnpm add -D tsx typescript vitest @types/js-yaml @types/node
   ```
4. `tsconfig.json`: `"strict": true`, `"target": "ES2022"`, `"module": "ESNext"`,
   `"moduleResolution": "Bundler"`, `"allowImportingTsExtensions": true`,
   `"noEmit": true`.
5. `vitest.config.ts` setup test root `scripts/tests/`.
6. Add `package.json` scripts:
   ```json
   {
     "scripts": {
       "typecheck": "tsc --noEmit",
       "test": "vitest run",
       "test:watch": "vitest",
       "install:user": "tsx scripts/install.ts user",
       "install:project": "tsx scripts/install.ts project",
       "validate": "tsx scripts/install.ts validate",
       "list": "tsx scripts/install.ts list",
       "sync": "tsx scripts/sync-from-upstream.ts",
       "init-private": "tsx scripts/init-private.ts",
       "clean-backups": "tsx scripts/clean-backups.ts"
     }
   }
   ```
7. Commit `chore: init TypeScript + pnpm toolchain`.

**Done when**: `pnpm typecheck` xanh, `pnpm test` chạy (0 test cũng OK).

### 5.3. Phase 1 — Core foundation

**Goal**: skeleton mới có cấu trúc + 1 component + 1 preset thật để verify flow
provenance + reference.

**Steps**:

1. **Tạo cấu trúc thư mục rỗng** (`.gitkeep` để track):
   - `claudekit/{agents,skills,commands,hooks,rules}/`
   - `claudekit/private.example/{agents,skills,commands,hooks,rules}/.gitkeep`
   - `presets/{core,framework,purpose}/`
   - `presets/private.example/{core,framework,purpose}/.gitkeep`
   - `presets/schema/`
   - `plugins/` (rỗng, .gitkeep)
   - `scripts/lib/`
   - Update `.gitignore` đầy đủ private rules.

2. **Định nghĩa schema (TypeScript-first)**:
   - `scripts/lib/schema.ts` — zod schemas cho `Preset`, `Sidecar`, `Manifest`. Types
     được suy ra từ zod (`z.infer<typeof PresetSchema>`).
   - Generate JSON Schema cho preset từ zod (qua `zod-to-json-schema`) → ghi ra
     `presets/schema/preset.schema.json` để VS Code YAML extension validate preset
     YAML qua comment header `# yaml-language-server: $schema=...`.
   - Document format sidecar trong `docs/PROVENANCE.md`.

3. **Vendor 1 component thật từ ECC** (verify provenance + dependencies flow end-to-end):
   - Chọn 1 agent đơn giản từ `upstream/everything-claude-code/agents/` (vd
     `code-reviewer.md`).
   - Copy → `claudekit/agents/code-reviewer.md`.
   - Tạo `claudekit/agents/code-reviewer.source.yaml`:
     ```yaml
     source:
       repo: https://github.com/affaan-m/everything-claude-code
       commit: <git -C upstream/everything-claude-code rev-parse HEAD>
       path: agents/code-reviewer.md
       ref: main
     imported_at: 2026-05-07
     license: MIT
     modified: false
     modifications: null
     notes: null
     # CQ-12: inter-component dependencies
     dependencies:
       required:
         agents: []
         skills:
           - coding-standards   # agent này cần skill rules để hoạt động đúng
         commands: []
         hooks: []
         rules: []
       optional:
         agents: []
         skills: []
         commands: []
         hooks: []
         rules: []
       external: []
     ```
   - Tương tự vendor 1 skill (folder) để verify SOURCE.yaml flow:
     - Copy `upstream/.../skills/coding-standards/` → `claudekit/skills/coding-standards/`
       (toàn folder).
     - Tạo `claudekit/skills/coding-standards/SOURCE.yaml` (cùng schema, deps có thể
       trống cho skill foundation).
   - **Test deps resolution end-to-end**: preset chỉ list `agents: [code-reviewer]` →
     resolver tự kéo skill `coding-standards` qua sidecar deps → verify install plan
     đúng.

4. **Tạo 1 preset thật**:
   - `presets/core/personal-baseline.yaml`:
     ```yaml
     # yaml-language-server: $schema=../schema/preset.schema.json
     name: personal-baseline
     kind: core
     description: Cross-stack baseline cho mọi project.
     version: 0.1.0
     extends: []
     components:
       agents:
         - code-reviewer
       skills:
         - coding-standards
       commands: []
       hooks: []
       rules: []
     settings_patch: {}
     tags:
       - baseline
     ```
   - `presets/core/personal-baseline.md` — human docs (when to use, rationale).

5. **Script `scripts/sync-from-upstream.ts` (skeleton)**:
   - Invocation qua `pnpm sync <component>` (script trong package.json wrap `tsx`).
   - Input: component path (vd `agents/code-reviewer`).
   - Đọc sidecar `.source.yaml` qua `scripts/lib/sidecar.ts` → `source_commit`.
   - Spawn `git -C upstream/<repo> fetch && git diff <source_commit>..HEAD -- <source_path>`
     → print diff cho owner.
   - Owner copy/merge thủ công (Phase 1 chưa auto-apply).

6. **Docs**:
   - `docs/PRIVATE.md` — convention, gitignore rule, bootstrap manual cho máy mới.
   - `docs/PROVENANCE.md` — schema sidecar + workflow sync.
   - `docs/PRESETS.md` — preset schema + cách viết.
   - Update `docs/architecture.md` — thay nội dung skeleton bằng design mới.
   - Update root `CLAUDE.md` — reflect 5 phase + decisions chính.

7. **Validate** — `scripts/install.ts validate <preset>`:
   - Đọc preset JSON, parse qua zod schema → throw nếu sai.
   - Đọc mọi component IDs trong preset, kiểm tra path tồn tại trong
     `claudekit/<type>/<id>` hoặc `claudekit/private/<type>/<id>`.
   - Đọc mọi sidecar (`.source.yaml` và `SOURCE.yaml` cho skill folder), parse zod →
     valid.
   - Vitest test cho schema validation.

**Risks giải quyết**: R4 (provenance + commit pin trong sidecar thay null).

**Done when**: chạy script validate xanh, có thể `cat` được provenance của 1 component
+ `cat` được preset chốt.

### 5.4. Phase 2 — Install pipeline

> Xem chi tiết: [`docs/planning/phase-2-install-pipeline.md`](planning/phase-2-install-pipeline.md)

**Goal**: cài 1 preset vào target user/project được, idempotent, có manifest.

**Milestones** (xem file planning để track từng step):
- M1: Resolver (extends tree + deps recursive, pure/no-fs)
- M2: FS ops + manifest atomic read/write
- M3: `install:user` command end-to-end
- M4: `install:project` command
- M5: `init-private` + `clean-backups` utilities

**Risks giải quyết**: R1, R2, R3, R5.

**Done when**: cài + re-cài + dry-run + 1 preset extends 1 preset khác đều chạy đúng.

### 5.5. Phase 3 — Lifecycle

> Xem chi tiết: [`docs/planning/phase-3-lifecycle.md`](planning/phase-3-lifecycle.md)

**Goal**: lifecycle đầy đủ — uninstall, upgrade, audit.

**Done when**: install → modify → uninstall round-trip clean (target không leftover).

### 5.6. Phase 4 — Marketplace + plugin

> Xem chi tiết: [`docs/planning/phase-4-marketplace.md`](planning/phase-4-marketplace.md)

**Goal**: 1-2 preset đầu publish được lên marketplace tự host.

**Done when**: round-trip publish + install qua marketplace thành công ít nhất 1 preset.

### 5.7. Phase 5+ — Defer

Khi nào cần thì thêm vào schema + installer:
- `mcp_servers` field trong preset.
- `target_levels` field (nếu thấy gõ nhầm level nhiều lần).
- preset extends `override` / `exclude` khi pattern repeat xuất hiện.
- `tags` filter command (`claudekit list --tag <tag>`).
- Plugin level install (`~/.claude/plugins/<name>/`).
- CI: validate schema + reference + lint sidecar.

### 5.8. Risks tracking

Ánh xạ risks Section 1 → phase giải quyết:

| Risk | Phase | Cách giải quyết |
|---|---|---|
| R1 — `rm -rf` destructive | 0 (xoá installer cũ), 2 (defensive guard mới) | Verify `$dst` non-empty + nằm trong target dir trước khi xoá; explicit `--target` thay CWD-dependent. |
| R2 — Awk parser fragile | 2 | TypeScript + zod schema. `js-yaml` cho YAML, `JSON.parse` builtin. Compile-time types + runtime validation. Awk bị xoá hoàn toàn. |
| R3 — `rsync -a` không cleanup | 2 | Manifest tracking thay rsync mù. Phase 3 uninstall đọc manifest, không guess. |
| R4 — `pinned_commit: null` | 1 | Sidecar có `source_commit` chính xác. Update `dependencies.yaml` với pin thật. |
| R5 — CLAUDE.md skip nếu tồn | 2 | Settings_patch + manifest tracking thay template skip-if-exists. CLAUDE.md template còn đó nhưng không phải cơ chế chính. |
| R6 — Symlink absolute path | 2 (user level vẫn symlink, document rõ) | Doc `INSTALL.md` ghi rõ symlink phụ thuộc dotclaude path. Migration script khi move repo. Project level copy (CQ-5b) → đa số use case không bị. |

### 5.9. Open questions giải quyết

| Q | Phase | Note |
|---|---|---|
| Q1 — ECC installer API | KHÔNG còn dùng | Phase 0 wipe → không gọi ECC installer nữa. |
| Q2 — Personal overlays nội dung | 1 + ongoing | Phase 1 tạo 1 overlay mẫu. Owner thêm dần. |
| Q3 — Settings.json strategy | 2 | settings_patch + deep-merge + manifest. |
| Q4 — Preset extends | 1 (schema), 2 (resolver) | Đã chốt CÓ ngay phase 1, schema sẵn. |
| Q5 — Lockfile reproducible | 5+ | Manifest đã 1 phần. Lockfile riêng nếu cần Phase 5+. |
| Q6 — CI validation | 5+ | Defer. |
| Q7 — Multi-machine bootstrap | 1 (private), N/A | Manual per CQ-4d. Repo dotclaude clone đủ cho public. |
| Q8 — Update workflow | 1 (sync-from-upstream), 3 (upgrade) | Tách 2 layer: upstream sync (refresh source) vs install upgrade (refresh target). |
