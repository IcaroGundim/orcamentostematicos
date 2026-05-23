'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
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
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function hitsForeignOverlayTarget(x: number, y: number, container: HTMLElement | null) {
  if (!container) return false;

  return document.elementsFromPoint(x, y).some((element) => {
    if (!(element instanceof Element)) return false;
    if (container.contains(element)) return false;
    return Boolean(
      element.closest('[data-slot="select-trigger"]') ||
        element.closest('[data-slot="select-content"]') ||
        element.closest('[data-slot="searchable-combobox"]'),
    );
  });
}

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
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      const inside = containerRef.current?.contains(target) ?? false;
      const foreignTarget = hitsForeignOverlayTarget(
        event.clientX,
        event.clientY,
        containerRef.current,
      );

      if (!inside || foreignTarget) {
        closeCombobox();
      }
    }

    function handleFocusIn(event: FocusEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;

      if (target instanceof Element) {
        if (
          target.closest('[data-slot="select-trigger"]') ||
          target.closest('[data-slot="select-content"]') ||
          target.closest('[data-slot="searchable-combobox"]')
        ) {
          closeCombobox();
        }
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
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </div>
      {open && !disabled ? (
        <div
          data-slot="searchable-combobox-content"
          className={cn(
            'absolute mt-1',
            dropdownContentClassName,
            matchTriggerWidth ? 'left-0 right-0 w-full min-w-0' : 'right-0 w-80 sm:right-auto sm:left-0',
          )}
        >
          {filtered.length > 0 ? (
            filtered.map((item) => (
              <button
                key={item.value || '__empty__'}
                type="button"
                data-highlighted={undefined}
                className={dropdownItemClassName}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(item.value);
                  setInputValue('');
                  setOpen(false);
                }}
              >
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
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
      ) : null}
    </div>
  );
}
