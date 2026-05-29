'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
};

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

type MenuPosition = { top: number; left: number; width: number };

export function SearchableCombobox({
  value,
  onChange,
  items,
  placeholder = 'Selecione...',
  disabled = false,
  className,
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const selected = items.find((item) => item.value === value);
  const displayValue = selected?.label ?? '';
  const matchTriggerWidth = /\bw-full\b/.test(className ?? '');

  const filtered = useMemo(() => {
    if (!inputValue.trim()) return items;
    const q = normalize(inputValue);
    return items.filter((item) => normalize(item.label).includes(q));
  }, [inputValue, items]);

  function closeCombobox() {
    setOpen(false);
    setInputValue('');
  }

  const updatePosition = useCallback(() => {
    const trigger = containerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 4;
    const margin = 8;
    const width = matchTriggerWidth
      ? rect.width
      : Math.min(320, window.innerWidth - margin * 2);
    const maxLeft = window.innerWidth - margin - width;
    const left = Math.max(margin, Math.min(rect.left, maxLeft));
    setPosition({ top: rect.bottom + gap, left, width });
  }, [matchTriggerWidth]);

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
          disabled && 'cursor-not-allowed opacity-50',
        )}
        onClick={openCombobox}
      >
        <input
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
            setInputValue('');
            setOpen(true);
          }}
        />
        <ChevronDownIcon className={dropdownChevronClassName} />
      </div>
      {open && !disabled && position
        ? createPortal(
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
                maxWidth: `min(${window.innerWidth - 16}px, 42rem)`,
              }}
              className={cn(
                'animate-in fade-in-0 zoom-in-95 duration-150',
                dropdownContentClassName,
              )}
            >
              <div className="max-h-[min(20rem,60vh)] overflow-y-auto overscroll-contain">
                {filtered.length > 0 ? (
                  filtered.map((item) => (
                    <button
                      key={item.value || '__empty__'}
                      type="button"
                      data-highlighted={undefined}
                      data-state={item.value === value ? 'checked' : undefined}
                      className={cn(dropdownItemClassName, 'items-start')}
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
                      <span className={dropdownItemIndicatorClassName}>
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
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
