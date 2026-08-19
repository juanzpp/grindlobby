import type {Config} from "tailwindcss";

const color=(token:string)=>`oklch(var(--${token}) / <alpha-value>)`;

const config:Config={
  content:["./app/**/*.{ts,tsx}","./components/**/*.{ts,tsx}"],
  theme:{
    extend:{
      colors:{
        background:color("gl-background"),
        foreground:color("gl-foreground"),
        card:color("gl-card"),
        panel:color("gl-panel"),
        primary:color("gl-primary"),
        "primary-glow":color("gl-primary-glow"),
        secondary:color("gl-secondary"),
        muted:color("gl-muted"),
        "muted-foreground":color("gl-muted-foreground"),
        accent:color("gl-accent"),
        destructive:color("gl-destructive"),
        success:color("gl-success"),
        warning:color("gl-warning"),
        border:color("gl-border"),
        input:color("gl-input"),
      },
      fontFamily:{
        display:["Chakra Petch","Inter","ui-sans-serif","system-ui"],
        sans:["Inter","ui-sans-serif","system-ui"],
      },
    },
  },
  plugins:[],
};

export default config;
