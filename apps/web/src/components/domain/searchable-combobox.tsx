'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  dropdownChevronClassName,
  dropdownContentClassName,
  dropdownEmptyClassName,
  dropdownItemClassName,
  dropdownItemIndicatorClassName,
  dropdownTriggerClassName,
  dropdownTriggerFocusWithinClassName,
} from '@/components/ui/dropdown-styles';

export type SearchableComboboxItem = {
  value: string;
  label: string;
};

export type SearchableComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  items: SearchableComboboxItem[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
};

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

type MenuPosition = { top: number; left: number; width: number; connectorTop: number };
type ScrollMetrics = {
  visible: boolean;
  thumbHeight: number;
  thumbTop: number;
  maxScroll: number;
  scrollTop: number;
};

const initialScrollMetrics: ScrollMetrics = {
  visible: false,
  thumbHeight: 0,
  thumbTop: 0,
  maxScroll: 0,
  scrollTop: 0,
};

export function SearchableCombobox({
  value,
  onChange,
  items,
  placeholder = 'Selecione...',
  disabled = false,
  className,
  triggerClassName,
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [scrollMetrics, setScrollMetrics] = useState<ScrollMetrics>(initialScrollMetrics);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const scrollTrackRef = useRef<HTMLDivElement>(null);
  const scrollDragRef = useRef<{ pointerId: number; startY: number; startScrollTop: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ignoreFocusRef = useRef(false);
  const scrollViewportId = useId();

  const selected = items.find((item) => item.value === value);
  const displayValue = selected?.label ?? '';

  const filtered = useMemo(() => {
    if (!inputValue.trim()) return items;
    const q = normalize(inputValue);
    return items.filter((item) => normalize(item.label).includes(q));
  }, [inputValue, items]);

  const updateScrollMetrics = useCallback(() => {
    const viewport = scrollViewportRef.current;
    const track = scrollTrackRef.current;
    if (!viewport || !track) return;

    const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    const trackHeight = track.clientHeight;
    const visible = maxScroll > 1 && trackHeight > 0;
    const thumbHeight = visible
      ? Math.min(trackHeight, Math.max(36, trackHeight * (viewport.clientHeight / viewport.scrollHeight)))
      : trackHeight;
    const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
    const thumbTop = maxScroll > 0 ? (viewport.scrollTop / maxScroll) * maxThumbTop : 0;

    setScrollMetrics({
      visible,
      thumbHeight,
      thumbTop,
      maxScroll,
      scrollTop: viewport.scrollTop,
    });
  }, []);

  function closeCombobox() {
    setOpen(false);
    setInputValue('');
  }

  const updatePosition = useCallback(() => {
    const trigger = containerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    const width = Math.min(rect.width, window.innerWidth - margin * 2);
    const maxLeft = window.innerWidth - margin - width;
    const left = Math.max(margin, Math.min(rect.left, maxLeft));
    const menuGap = 6;
    setPosition({
      top: rect.bottom + menuGap,
      left,
      width,
      connectorTop: rect.bottom - 1,
    });
  }, []);

  // Recalcula a posição ao abrir e mantém alinhado durante scroll/resize.
  useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) {
      setScrollMetrics(initialScrollMetrics);
      return;
    }

    const observer = new ResizeObserver(updateScrollMetrics);
    const frame = window.requestAnimationFrame(() => {
      updateScrollMetrics();
      const viewport = scrollViewportRef.current;
      if (viewport) observer.observe(viewport);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [filtered.length, open, updateScrollMetrics]);

  useEffect(() => {
    if (!open) return;

    function isInside(target: Node) {
      return (
        (containerRef.current?.contains(target) ?? false) ||
        (contentRef.current?.contains(target) ?? false)
      );
    }

    function handlePointerDown(event: PointerEvent) {
      if (!isInside(event.target as Node)) {
        closeCombobox();
      }
    }

    function handleFocusIn(event: FocusEvent) {
      if (!isInside(event.target as Node)) {
        closeCombobox();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeCombobox();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function openCombobox() {
    if (disabled) return;
    setOpen(true);
  }

  function scrollFromTrackPointer(clientY: number) {
    const viewport = scrollViewportRef.current;
    const track = scrollTrackRef.current;
    if (!viewport || !track || scrollMetrics.maxScroll <= 0) return;

    const trackRect = track.getBoundingClientRect();
    const maxThumbTop = Math.max(0, track.clientHeight - scrollMetrics.thumbHeight);
    const thumbTop = Math.max(
      0,
      Math.min(clientY - trackRect.top - scrollMetrics.thumbHeight / 2, maxThumbTop),
    );
    viewport.scrollTop = maxThumbTop > 0
      ? (thumbTop / maxThumbTop) * scrollMetrics.maxScroll
      : 0;
  }

  return (
    <div
      ref={containerRef}
      data-slot="searchable-combobox"
      className={cn('relative w-full', className)}
    >
      <div
        data-slot="searchable-combobox-trigger"
        data-state={open ? 'open' : 'closed'}
        className={cn(
          dropdownTriggerClassName,
          dropdownTriggerFocusWithinClassName,
          'cursor-pointer',
          open &&
            'rounded-t-[4px] rounded-b-none border-input border-b-transparent bg-background shadow-none focus-within:border-input focus-within:ring-0 data-[state=open]:border-input data-[state=open]:border-b-transparent data-[state=open]:ring-0',
          disabled && 'cursor-not-allowed opacity-50',
          triggerClassName,
        )}
        onPointerDown={(e) => {
          if (disabled) return;
          if (open) {
            // Segundo clique no trigger: retrai. preventDefault evita reabrir
            // via foco; o guard cobre navegadores que ainda disparam o focus.
            e.preventDefault();
            ignoreFocusRef.current = true;
            closeCombobox();
            inputRef.current?.blur();
            window.setTimeout(() => {
              ignoreFocusRef.current = false;
            }, 0);
          } else if (e.target !== inputRef.current) {
            // Clique no chevron/área do trigger (não no input): abre e foca.
            e.preventDefault();
            openCombobox();
            inputRef.current?.focus();
          }
        }}
      >
        <input
          ref={inputRef}
          disabled={disabled}
          className="min-w-0 flex-1 truncate bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          placeholder={placeholder}
          value={open ? inputValue : displayValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (disabled) return;
            if (ignoreFocusRef.current) {
              ignoreFocusRef.current = false;
              return;
            }
            setInputValue('');
            setOpen(true);
          }}
        />
        <ChevronDownIcon className={dropdownChevronClassName} />
      </div>
      {open && !disabled && position
        ? createPortal(
            <>
              <span
                aria-hidden="true"
                className="pointer-events-none fixed z-[51] border-x border-input bg-popover"
                style={{
                  top: position.connectorTop,
                  left: position.left,
                  width: position.width,
                  height: position.top - position.connectorTop + 1,
                }}
              />
              <div
                ref={contentRef}
                data-slot="searchable-combobox-content"
                role="listbox"
                // Impede que componentes de dismiss (ex.: Radix Popover com modal={false})
                // tratem a interação no menu portado como clique "fora" e fechem o pai.
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  position: 'fixed',
                  top: position.top,
                  left: position.left,
                  minWidth: position.width,
                  width: 'max-content',
                  maxWidth: `min(${window.innerWidth - position.left - 8}px, 42rem)`,
                }}
                className={cn(
                  'searchable-combobox-expand',
                  dropdownContentClassName,
                  'relative rounded-xl rounded-tl-none border-input bg-popover shadow-[0_12px_24px_rgb(0_0_0/0.14)] ring-0',
                )}
              >
              <div className="relative">
                <div
                  id={scrollViewportId}
                  ref={scrollViewportRef}
                  className="searchable-combobox-scrollbar max-h-[min(20rem,60vh)] overflow-y-auto overscroll-contain p-1 pr-4"
                  onScroll={updateScrollMetrics}
                >
                  {filtered.length > 0 ? (
                    filtered.map((item) => (
                      <button
                        key={item.value || '__empty__'}
                        type="button"
                        data-highlighted={undefined}
                        data-state={item.value === value ? 'checked' : undefined}
                        className={cn(
                          dropdownItemClassName,
                          'items-start rounded-lg px-3 py-2.5 pr-9 hover:bg-muted/70 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:hover:bg-primary/90 data-[state=checked]:hover:text-primary-foreground data-[state=checked]:focus:bg-primary data-[state=checked]:focus:text-primary-foreground',
                        )}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          onChange(item.value);
                          setInputValue('');
                          setOpen(false);
                        }}
                      >
                        <span className="min-w-0 flex-1 whitespace-normal break-words text-left leading-snug">
                          {item.label}
                        </span>
                        <span
                          className={cn(
                            dropdownItemIndicatorClassName,
                            item.value === value && 'text-primary-foreground',
                          )}
                        >
                          {item.value === value ? (
                            <CheckIcon className="size-4 shrink-0" />
                          ) : null}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className={dropdownEmptyClassName}>Nenhum resultado</div>
                  )}
                </div>
                <div
                  ref={scrollTrackRef}
                  role="scrollbar"
                  aria-controls={scrollViewportId}
                  aria-orientation="vertical"
                  aria-valuemin={0}
                  aria-valuemax={Math.round(scrollMetrics.maxScroll)}
                  aria-valuenow={Math.round(scrollMetrics.scrollTop)}
                  tabIndex={scrollMetrics.visible ? 0 : -1}
                  className={cn(
                    'group absolute top-2 right-1.5 bottom-2 w-2 bg-transparent outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-ring/60',
                    scrollMetrics.visible ? 'opacity-100' : 'pointer-events-none opacity-0',
                  )}
                  onPointerDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    event.preventDefault();
                    event.currentTarget.focus({ preventScroll: true });
                    scrollFromTrackPointer(event.clientY);
                  }}
                  onKeyDown={(event) => {
                    const viewport = scrollViewportRef.current;
                    if (!viewport) return;
                    const steps: Partial<Record<typeof event.key, number>> = {
                      ArrowUp: -40,
                      ArrowDown: 40,
                      PageUp: -viewport.clientHeight * 0.8,
                      PageDown: viewport.clientHeight * 0.8,
                      Home: -scrollMetrics.maxScroll,
                      End: scrollMetrics.maxScroll,
                    };
                    const step = steps[event.key];
                    if (step === undefined) return;
                    event.preventDefault();
                    viewport.scrollTop = event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? scrollMetrics.maxScroll
                        : viewport.scrollTop + step;
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-[2px] cursor-grab touch-none rounded-full bg-foreground/65 shadow-[0_1px_2px_rgb(0_0_0/0.24)] transition-[left,right,background-color] group-hover:inset-x-px hover:bg-foreground/85 active:inset-x-0 active:cursor-grabbing active:bg-foreground"
                    style={{
                      height: scrollMetrics.thumbHeight,
                      transform: `translateY(${scrollMetrics.thumbTop}px)`,
                    }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      event.currentTarget.setPointerCapture(event.pointerId);
                      scrollDragRef.current = {
                        pointerId: event.pointerId,
                        startY: event.clientY,
                        startScrollTop: scrollViewportRef.current?.scrollTop ?? 0,
                      };
                    }}
                    onPointerMove={(event) => {
                      const drag = scrollDragRef.current;
                      const viewport = scrollViewportRef.current;
                      const track = scrollTrackRef.current;
                      if (!drag || drag.pointerId !== event.pointerId || !viewport || !track) return;
                      const maxThumbTravel = track.clientHeight - scrollMetrics.thumbHeight;
                      if (maxThumbTravel <= 0) return;
                      viewport.scrollTop = drag.startScrollTop
                        + ((event.clientY - drag.startY) / maxThumbTravel) * scrollMetrics.maxScroll;
                    }}
                    onPointerUp={(event) => {
                      if (scrollDragRef.current?.pointerId === event.pointerId) {
                        scrollDragRef.current = null;
                        event.currentTarget.releasePointerCapture(event.pointerId);
                      }
                    }}
                    onPointerCancel={() => {
                      scrollDragRef.current = null;
                    }}
                  />
                </div>
              </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}
