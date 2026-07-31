"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

type HoverTabsListItem = {
  value: string
  content: React.ReactNode
  className?: string
}

/**
 * Rastreia a "pílula" deslizante que segue o mouse/foco entre as abas e volta para
 * a aba ativa quando o ponteiro sai da lista.
 *
 * Cada item precisa carregar `data-hover-tab-value` com o seu valor — é por esse
 * atributo que a posição e a largura são medidas. O container precisa ser
 * `relative`, já que a pílula é posicionada em absoluto dentro dele.
 *
 * Extraído para ser compartilhado entre a lista de abas dos orçamentos temáticos
 * ({@link HoverTabsList}) e outras barras de navegação que não usam Radix Tabs,
 * garantindo que a animação seja literalmente a mesma nas duas.
 */
const EMPTY_BOX = { left: 0, top: 0, width: 0, height: 0, ready: false }

function useHoverPill(activeValue: string) {
  const listRef = React.useRef<HTMLDivElement>(null)
  const highlightRef = React.useRef(activeValue)
  const [highlightValue, setHighlightValue] = React.useState(activeValue)
  const [pill, setPill] = React.useState(EMPTY_BOX)
  // Marcador do item realmente selecionado. Separado de `pill` porque aquele segue o
  // mouse; este só se move quando a seleção muda — é o que faz o retângulo deslizar
  // de um item para o outro em vez de saltar.
  const [activePill, setActivePill] = React.useState(EMPTY_BOX)

  // Mede a caixa inteira (e não só o eixo horizontal) para o mesmo hook servir tanto
  // a listas em linha quanto em coluna: cada consumidor usa os lados que interessam.
  const measure = React.useCallback((value: string) => {
    const list = listRef.current
    if (!list) return null
    const target = list.querySelector<HTMLElement>(`[data-hover-tab-value="${value}"]`)
    if (!target) return null
    return {
      left: target.offsetLeft,
      top: target.offsetTop,
      width: target.offsetWidth,
      height: target.offsetHeight,
      ready: true,
    }
  }, [])

  const updatePill = React.useCallback(
    (value: string) => {
      const next = measure(value)
      if (next) setPill(next)
    },
    [measure],
  )

  const updateActivePill = React.useCallback(
    (value: string) => {
      const next = measure(value)
      if (next) setActivePill(next)
    },
    [measure],
  )

  const highlight = React.useCallback(
    (value: string) => {
      highlightRef.current = value
      setHighlightValue(value)
      updatePill(value)
    },
    [updatePill],
  )

  const resetHighlight = React.useCallback(() => highlight(activeValue), [activeValue, highlight])

  React.useLayoutEffect(() => {
    highlight(activeValue)
    updateActivePill(activeValue)
  }, [activeValue, highlight, updateActivePill])

  React.useEffect(() => {
    const list = listRef.current
    if (!list) return
    const onResize = () => {
      updatePill(highlightRef.current)
      updateActivePill(activeValue)
    }
    const resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(list)
    window.addEventListener('resize', onResize)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', onResize)
    }
  }, [updatePill, updateActivePill, activeValue])

  return { listRef, pill, activePill, highlightValue, highlight, resetHighlight }
}

function HoverTabsList({
  activeValue,
  items,
  className,
}: {
  activeValue: string
  items: readonly HoverTabsListItem[]
  className?: string
}) {
  const { listRef, pill, highlightValue, highlight, resetHighlight } = useHoverPill(activeValue)

  return (
    <TabsList
      ref={listRef}
      className={cn('relative border border-primary bg-white', className)}
      onMouseLeave={resetHighlight}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-[3px] z-0 h-[calc(100%-6px)] rounded-md bg-primary shadow-md',
          'transition-[left,width] duration-500 ease-out',
          pill.ready ? 'opacity-100' : 'opacity-0',
        )}
        style={{ left: pill.left, width: pill.width }}
      />
      {items.map((item) => {
        const highlighted = highlightValue === item.value
        return (
          <TabsTrigger
            key={item.value}
            value={item.value}
            data-hover-tab-value={item.value}
            onFocus={() => highlight(item.value)}
            onMouseEnter={() => highlight(item.value)}
            className={cn(
              'relative z-10 border-0 bg-transparent shadow-none transition-none',
              'data-active:bg-transparent data-active:shadow-none',
              highlighted
                ? 'text-white data-active:text-white hover:text-white'
                : 'text-foreground/70 data-active:text-foreground/70 hover:text-foreground',
              item.className,
            )}
          >
            {item.content}
          </TabsTrigger>
        )
      })}
    </TabsList>
  )
}

function TabsContent({
  className,
  forceMount,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      forceMount={forceMount}
      className={cn(
        "flex-1 text-sm outline-none",
        forceMount && "data-[state=inactive]:hidden",
        className
      )}
      {...props}
    />
  )
}

export {
  Tabs,
  TabsList,
  TabsTrigger,
  HoverTabsList,
  TabsContent,
  tabsListVariants,
  useHoverPill,
}
