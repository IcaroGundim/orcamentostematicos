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

function HoverTabsList({
  activeValue,
  items,
  className,
}: {
  activeValue: string
  items: readonly HoverTabsListItem[]
  className?: string
}) {
  const listRef = React.useRef<HTMLDivElement>(null)
  const highlightRef = React.useRef(activeValue)
  const [highlightTab, setHighlightTab] = React.useState(activeValue)
  const [pill, setPill] = React.useState({ left: 0, width: 0, ready: false })

  const updatePill = React.useCallback((tabValue: string) => {
    const list = listRef.current
    if (!list) return
    const trigger = list.querySelector<HTMLElement>(`[data-hover-tab-value="${tabValue}"]`)
    if (!trigger) return
    setPill({
      left: trigger.offsetLeft,
      width: trigger.offsetWidth,
      ready: true,
    })
  }, [])

  React.useLayoutEffect(() => {
    highlightRef.current = activeValue
    setHighlightTab(activeValue)
    updatePill(activeValue)
  }, [activeValue, updatePill])

  React.useEffect(() => {
    const list = listRef.current
    if (!list) return
    const onResize = () => updatePill(highlightRef.current)
    const resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(list)
    window.addEventListener('resize', onResize)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', onResize)
    }
  }, [updatePill])

  return (
    <TabsList
      ref={listRef}
      className={cn('relative border border-primary bg-white', className)}
      onMouseLeave={() => {
        highlightRef.current = activeValue
        setHighlightTab(activeValue)
        updatePill(activeValue)
      }}
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
        const highlighted = highlightTab === item.value
        return (
          <TabsTrigger
            key={item.value}
            value={item.value}
            data-hover-tab-value={item.value}
            onFocus={() => {
              highlightRef.current = item.value
              setHighlightTab(item.value)
              updatePill(item.value)
            }}
            onMouseEnter={() => {
              highlightRef.current = item.value
              setHighlightTab(item.value)
              updatePill(item.value)
            }}
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

export { Tabs, TabsList, TabsTrigger, HoverTabsList, TabsContent, tabsListVariants }
