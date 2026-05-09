import * as React from "react";

type IconProps = React.SVGProps<SVGSVGElement> & {
  title?: string;
};

export function Icon({
  title,
  children,
  ...props
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      role={title ? "img" : "presentation"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function IconSparkle(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 2l1.2 3.6L17 7l-3.8 1.4L12 12l-1.2-3.6L7 7l3.8-1.4L12 2Z" />
      <path d="M5 13l.8 2.3L8 16l-2.2.7L5 19l-.8-2.3L2 16l2.2-.7L5 13Z" />
      <path d="M19 12l.9 2.8L23 16l-3.1 1.2L19 20l-.9-2.8L15 16l3.1-1.2L19 12Z" />
    </Icon>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
      <path d="M16.3 16.3 21 21" />
    </Icon>
  );
}

export function IconBell(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7Z" />
      <path d="M9.8 19a2.4 2.4 0 0 0 4.4 0" />
    </Icon>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m10 6 6 6-6 6" />
    </Icon>
  );
}

export function IconMenu(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </Icon>
  );
}

export function IconDot(props: IconProps) {
  return (
    <Icon {...props} viewBox="0 0 8 8" strokeWidth="0">
      <circle cx="4" cy="4" r="3.2" fill="currentColor" />
    </Icon>
  );
}

export function IconPencil(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </Icon>
  );
}

export function IconLogout(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 17H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4" />
      <path d="M16 12H8" />
      <path d="m16 12-3-3" />
      <path d="m16 12-3 3" />
      <path d="M20 7v10" />
    </Icon>
  );
}

export function IconLock(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 11V8a5 5 0 0 1 10 0v3" />
      <path d="M6.5 11h11A2.5 2.5 0 0 1 20 13.5v6A2.5 2.5 0 0 1 17.5 22h-11A2.5 2.5 0 0 1 4 19.5v-6A2.5 2.5 0 0 1 6.5 11Z" />
      <path d="M12 16v2" />
    </Icon>
  );
}

export function IconUnlock(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 11V8a4 4 0 0 1 7.7-1.6" />
      <path d="M6.5 11h11A2.5 2.5 0 0 1 20 13.5v6A2.5 2.5 0 0 1 17.5 22h-11A2.5 2.5 0 0 1 4 19.5v-6A2.5 2.5 0 0 1 6.5 11Z" />
      <path d="M12 16v2" />
    </Icon>
  );
}
