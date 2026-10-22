/**
 * The design tokens live in `packages/theme/src/tokens.ts`, and only there.
 *
 * This file used to be a second copy. It drifted: by the time anyone noticed it was
 * missing `chart`, `pasture`, `storyTint`, `outfit`, `siteType` and `siteText`, and
 * nothing imported it, so nothing caught the drift. Two files claiming to be the
 * source of truth is worse than one file in an awkward place, and the build prompt
 * lists this path as a source — so the path stays and the copy goes.
 *
 * Add a token in packages/theme. Never here.
 */
export * from "../packages/theme/src/tokens";
