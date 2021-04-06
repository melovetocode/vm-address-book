import { Component, Directive, EventEmitter, Input, OnInit, Output, QueryList, ViewChildren } from '@angular/core';
import { FormControl, FormGroup, FormArray, FormBuilder, Validators } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { Address } from './address-book/address.model';


/********************************************************************************/
/*  Address Book Data
/********************************************************************************/

const ADDR_DATA = [
  {id: 501, name: 'John Smith', location: 'Palo Alto', office: 'C-103', officePhone: 'x55778', cellPhone: '650-353-1239'}
];




/********************************************************************************/
/*  Directive for table sort
/*  (source: ng-bootstrap with modification of case insensitive sort)
/********************************************************************************/

export type SortColumn = keyof Address | '';
export type SortDirection = 'asc' | 'desc' | '';
const rotate: {[key: string]: SortDirection} = { asc: 'desc', desc: '', '': 'asc' };

const compare = (v1: string | number, v2: string | number) => {
  v1 = typeof(v1) === 'string' ? v1.toLowerCase() : v1;
  v2 = typeof(v2) === 'string' ? v2.toLowerCase() : v2;
  return v1 < v2 ? -1 : v1 > v2 ? 1 : 0;
};

export interface SortEvent {
  column: SortColumn;
  direction: SortDirection;
}

@Directive({
  selector: 'th[sortable]',
  host: {
    '[class.asc]': 'direction === "asc"',
    '[class.desc]': 'direction === "desc"',
    '(click)': 'rotate()'
  }
})

export class NgbdSortableHeader {
  @Input() sortable: SortColumn = '';
  @Input() direction: SortDirection = '';
  @Output() sort = new EventEmitter<SortEvent>();

  rotate(): void {
    this.direction = rotate[this.direction];
    this.sort.emit({column: this.sortable, direction: this.direction});
  }
}

/********************************************************************************/


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent implements OnInit {
  @ViewChildren(NgbdSortableHeader) headers: QueryList<NgbdSortableHeader>;

  addressBookForm: FormGroup;
  dataSource = new Map(ADDR_DATA.map(i => [i.id, i]));
  dataArray = Object.assign(ADDR_DATA);
  maxId = 0;
  editableCell = new Map();
  allChecked = false;
  showModal = false;
  updatedEntries = [];

  constructor(
    private formBuilder: FormBuilder,
    public translate: TranslateService
  ) {
    translate.addLangs(['en', 'es', 'ko', 'zh-cn', 'zh-tw']);
    translate.setDefaultLang('en');

    const browserLang = translate.getBrowserLang();
    translate.use(browserLang.match(/en|es|ko|zh-cn|zh-tw/) ? browserLang : 'en');
  }

  ngOnInit(): void {
    this.getAddressBookForm();
  }

  private getAddressBookForm(): void {
    let addrEntries = new FormArray([]);
    this.addressBookForm = new FormGroup({
      entries: addrEntries
    });

    this.dataSource.forEach((row) => {
      this.maxId = row.id > this.maxId ? row.id : this.maxId;

      addrEntries.push(
        new FormGroup({
          selected: new FormControl(false),
          id: new FormControl(row.id),
          name: new FormControl(row.name, Validators.required),
          location: new FormControl(row.location),
          office: new FormControl(row.office),
          officePhone: new FormControl(row.officePhone),
          cellPhone: new FormControl(row.cellPhone)
        })
      );
      }
    );
  }

  private getEntry(): FormGroup {
    return this.formBuilder.group({
      selected: [false],
      id: [null],
      name: ['', Validators.required],
      location: [''],
      office: [''],
      officePhone: [''],
      cellPhone: ['']
  });}

  addEntry(): void {
    const control = this.addressBookForm.get('entries') as FormArray;
    control.push(this.getEntry());
  }

  deleteEntry(index: number): void {
    (this.addressBookForm.get('entries') as FormArray).removeAt(index);
  }

  deleteSelectedEntries(): void {
    // If "check all" checkbox is checked, delete all entries.
    if (this.allChecked) {
      (this.addressBookForm.get('entries') as FormArray).clear();
      this.dataSource.clear();
      this.allChecked = false;
      this.addEntry();
    }

    // Delete selected
    const entries = (this.addressBookForm.value.entries);
    for (let i = entries.length -1; i >= 0; i--) {
      if (entries[i].selected === true) {
        this.deleteEntry(i);
        this.dataSource.delete(entries[i].id);
      }
    };
  }

  isValidInput(entry): boolean {
    return entry.controls['name'].invalid &&
      (entry.controls['location'].value || entry.controls['office'].value || 
      entry.controls['officePhone'].value || entry.controls['cellPhone'].value);
  }

  save(): void {
    this.updatedEntries = Object.assign([]);
    const entries = this.addressBookForm.get('entries')['controls'];
    entries.forEach((entry, index) => {

      // Leave the row as-is if name is not filled
      if (entry.controls.name.invalid) { return; }

      // Check the row condition
      if (entry.controls.id.value && this.checkEditCell(index)) {
        this.dataSource.set(entry.controls.id.value, entry.value);
        this.updatedEntries.push({state: 'u', entry: entry.value});

      } else if (!entry.controls.id.value && entry.controls.name.dirty) {
        this.maxId++;
        const addr: Address = {
          id: this.maxId,
          name: entry.controls.name.value,
          location: entry.controls.location.value,
          office: entry.controls.office.value,
          officePhone: entry.controls.officePhone.value,
          cellPhone: entry.controls.cellPhone.value
        };

        entry.controls.id.setValue(this.maxId);
        this.dataSource.set(this.maxId, addr);
        this.updatedEntries.push({state: 'a', entry: addr});

      } else if (!entry.controls.id.value && !entry.controls.name.dirty) {
        this.deleteEntry(index);
      }
    });

    // Reset editableCell tracking to empty
    this.editableCell.clear();
    this.showModal = true;
  }

  // Uncheck "check all" checkbox when an individual checkbox is unchecked
  doSingleCheck(event): void {
    if (!event.target.checked) {
      this.allChecked = false;
    }
  }

  // Check/uncheck all checkboxes depending on the state of the "check all" checkbox
  checkAll(): void {
    this.allChecked = !this.allChecked;
    this.addressBookForm.get('entries')['controls'].map(entry => {
      entry.controls.selected.setValue(this.allChecked);
    });
  }

  // Track entries that have been double clicked for edit
  editCell(index: number): void {
    this.editableCell.set(index, true);
  }

  // Look up the entry whehter it should display an input box or not
  checkEditCell(index: number): boolean {
    return this.editableCell.has(index);
  }

  // Perform sorting
  onSort({column, direction}: SortEvent): any {
    // Resetting other headers
    this.headers.forEach(header => {
      if (header.sortable !== column) {
        header.direction = '';
      }
    });

    // Sorting entry
    const data = Array.from( this.dataSource.values() );
    if (direction === '' || column === '') {
      this.dataSource = new Map((
        [...data].sort((a, b) => {
        const res = compare(a['id'], b['id']);
        return res;
      }).map(i => [i.id, i])
      ));
    } else {
      this.dataSource = new Map((
          [...data].sort((a, b) => {
        const res = compare(a[column], b[column]);
        return direction === 'asc' ? res : -res;
      }).map(i => [i.id, i])
      ));
    }

    // Load the sorted entries to the form
    this.getAddressBookForm();
  }
}
