import { AddCadreDialogComponent } from './../add-cadre-dialog/add-cadre-dialog.component';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CadreService, CadreTypeInfo, ClassInfo, StudentInfo, CadreInfo, ClassCadreRecord } from './../../dal/cadre.service';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import * as XLSX from 'xlsx';
import { log } from 'console';

@Component({
  selector: 'app-class-summary',
  templateUrl: './class-summary.component.html',
  styleUrls: ['./class-summary.component.scss']
})
export class ClassSummaryComponent implements OnInit {

  cadreTypes: CadreTypeInfo[] = []; // 班級幹部類別清單
  classList = [];  // 根據教師ID取得班級清單
  studentList: StudentInfo[]; // 指定班級的學生清單
  dicStuds: { [studID: string]: StudentInfo } = {};  // 學生資料的 Dictionary 資料結構
  currentSemester: any;       // 目前學年學期
  selectedSchoolYear;  // 選擇的學年度
  selectedSemester;      // 選擇的學期

  currentDateTime: any;       // 可以設定幹部的期間
  nowDate: any;
  selectedStart;  // 開始日期
  selectedEnd;      // 結束日期
  selectedNow;      // 結束日期

  isCanSelectCarde = false;  // 是否是目前學年學期。如果是，才可以編輯資料。

  isCurrentSemester = false;  // 是否是目前學年學期。如果是，才可以編輯資料。
  selectedClass: ClassInfo;  // 被選擇的班級


  schoolYearNumbers = [];
  semesterNumbers = [1, 2];
  // maxSchoolYear = 130;       // 可選擇的最大學年度
  // minSchoolYear = 108;       // 可選擇的最小學年度

  cadres: CadreInfo[] = []; // 班級幹部清單，有指定學生的幹部紀錄。
  dicCadreUsage: { [uid: string]: string } = {};  // 紀錄有哪些幹部清單已經被讀取過了

  classCadres: ClassCadreRecord[] = []; // 畫面上的班級幹部清單

  isLoading = false;



  @ViewChild('table') table: ElementRef<HTMLDivElement>;
  @ViewChild('semester') semester: ElementRef<HTMLSelectElement>;

  constructor(
    private cadreService: CadreService,
    public dialog: MatDialog
  ) { }

  async ngOnInit(): Promise<void> {

    this.isLoading = true;


    // 1. get Cadre Types
    this.cadreTypes = await this.cadreService.getCadreTypes();
    // console.log(this.cadreTypes);

    // 2. get My Classes
    await this.queryClasses();
    // 3. get Students in the first class
    await this.loadStudents();

    // 4. get semesters by class.
    await this.getCurrentSemester();

    // 5. get Class Cadres Students of the specificed semesters.
    await this.reloadCadreData();

    // 6. 取得目前輸入開始結束入期
    await this.getOpenTeacherCadreDate();

  }

  // tslint:disable-next-line:typedef
  async queryClasses() {
    this.classList = await this.cadreService.getMyClasses();
    // console.log(this.classList);
    this.selectedClass = this.classList[0];
  }

  // tslint:disable-next-line:typedef
  async loadStudents() {
    if (this.selectedClass) {

      this.studentList = await this.cadreService.getStudents(this.selectedClass.ClassID);

      this.dicStuds = {}; // reset
      this.studentList.forEach(stud => {
        this.dicStuds[stud.StudentId] = stud;
      });
    }
  }

  /**
   * 取得指定班級，學年度，學期的幹部紀錄。
   */
  // tslint:disable-next-line:typedef
  async reloadCadreData() {
    this.isLoading = true;

    // 判斷是否適當學期，如果是，才可以編輯。
    this.isCurrentSemester = (this.selectedSchoolYear === parseInt(this.currentSemester.Response.SchoolYear, 10) &&
      this.selectedSemester === parseInt(this.currentSemester.Response.Semester, 10));

    // await this.cadreService.getClassCadreStudents(this.selectedClass.ClassID, this.selectedSchoolYear, this.selectedSemester);
    this.cadres = await this.cadreService.getClassCadreStudents(this.selectedClass.ClassID, this.selectedSchoolYear, this.selectedSemester);
    // console.log(this.cadres);
    this.dicCadreUsage = {};  // reset ;
    this.cadres.forEach(cadre => {
      if (!this.dicCadreUsage[cadre.uid]) {
        this.dicCadreUsage[cadre.uid] = 'no';  // 尚未被讀取
      }
    });
    // console.log(this.cadres);
    this.parseCadreRecords();

    this.isLoading = false;
  }

  // tslint:disable-next-line:typedef
  async getCurrentSemester() {
    // this.semesters = await this.cadreService.getSemestersByClassID(this.selectedClass.ClassID);
    // console.log(this.semesters);
    this.currentSemester = await this.cadreService.getCurrentSemester();

    // console.log(currentSemester);
    this.selectedSchoolYear = parseInt(this.currentSemester.Response.SchoolYear, 10);
    this.selectedSemester = parseInt(this.currentSemester.Response.Semester, 10);
    this.nowDate = new Date(this.currentSemester.Response.Now);
    console.log("目前時間 : " + this.formatDateToYYYYMMDD(this.nowDate));

    this.schoolYearNumbers.push(this.selectedSchoolYear - 2);
    this.schoolYearNumbers.push(this.selectedSchoolYear - 1);
    this.schoolYearNumbers.push(this.selectedSchoolYear);
    this.schoolYearNumbers.push(this.selectedSchoolYear + 1);

  }

  async getOpenTeacherCadreDate() {
    // this.semesters = await this.cadreService.getSemestersByClassID(this.selectedClass.ClassID);
    // console.log(this.semesters);
    this.currentDateTime = await this.cadreService.getOpenTeacherCadreDate();

    let startDate = null;
    let endDate = null;

    if (this.currentDateTime.Response !== undefined) {
      startDate = new Date(this.currentDateTime.Response.StartDate);
      endDate = new Date(this.currentDateTime.Response.EndDate);

      // 結束日期要加一天,減一秒才會是當天結束
      endDate.setDate(endDate.getDate() + 1);
      endDate.setSeconds(endDate.getSeconds() - 1);

      if (this.nowDate >= startDate && this.nowDate <= endDate) {
        this.isCanSelectCarde = true;
      } else {
        this.isCanSelectCarde = false; // 未在輸入期間
      }

      console.log("開始時間 : " + this.formatDateToYYYYMMDD(startDate));
      console.log("結束時間 : " + this.formatDateToYYYYMMDD(endDate));

    } else {
      this.isCanSelectCarde = false; // 未在輸入期間
    }


    if (startDate !== null) {
      this.selectedStart = this.formatDateToYYYYMMDD(startDate); // 開始日期
    } else {
      this.selectedStart = '[未設定開始時間]';
    }
    if (endDate !== null) {
      this.selectedEnd = this.formatDateToYYYYMMDD(endDate); // 結束日期
    } else {
      this.selectedEnd = '[未設定結束時間]';
    }

    if (this.nowDate !== null) {
      this.selectedNow = this.formatDateToYYYYMMDD(this.nowDate); // 目前日期
    } else {

    }


  }

  formatDateToYYYYMMDD(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // 月份从0开始，需要加1
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute} `;
  }

  // tslint:disable-next-line:typedef
  async changeClass() {
    await this.loadStudents();
    await this.reloadCadreData();
  }

  parseCadreRecords(): void {
    this.classCadres = [];  // reset
    this.cadreTypes.forEach(cadreType => {
      // console.log(cadreType);
      for (let i = 0; i < cadreType.Number; i++) {
        const classCadre = new ClassCadreRecord();
        classCadre.cadreType = cadreType;
        // console.log(`find type: ${cadreType.Cadrename}`)
        classCadre.cadre = this.chooseCadreRecordByType(cadreType.Cadrename);
        // console.log(classCadre.cadre);
        if (classCadre.cadre) {
          classCadre.student = this.dicStuds[classCadre.cadre.studentid];
        }
        this.classCadres.push(classCadre);
      }
    });
  }

  // 從班級幹部清單中讀取一筆指定類型的紀錄
  chooseCadreRecordByType(cadreName: string): CadreInfo {
    // console.log(cadreName);
    let result: CadreInfo;
    let hasFound = false;
    this.cadres.forEach(cadre => {
      // console.log(` cadreType: ${cadreType}, cadre: ${cadre}`);
      if (!hasFound) {
        if (this.dicCadreUsage[cadre.uid] === 'no' && cadre.cadrename === cadreName) {
          result = cadre;
          // console.log(cadre);
          this.dicCadreUsage[cadre.uid] = 'yes';  // 表示已經讀取過
          hasFound = true;
        }
      }
    });

    return result;
  }

  // tslint:disable-next-line:typedef
  async ChangDefSchool() {
    this.selectedSchoolYear = parseInt(this.currentSemester.Response.SchoolYear, 10);
    this.selectedSemester = parseInt(this.currentSemester.Response.Semester, 10);

    await this.reloadCadreData();
  }

  // tslint:disable-next-line:typedef
  async removeCadre(classCadre) {
    const result = confirm("你確定要刪除幹部紀錄嗎？");

    if (result) {
      await this.cadreService.deleteCadre(classCadre);
      await this.reloadCadreData();
    } else {
      this.showAlert();
      // 在這裡可以執行取消時的操作
    }
  }

  showAlert() {
    const alertContainer = document.getElementById('alertContainer');
    const alertBox = document.getElementById('alertBox');

    alertContainer.style.bottom = '20px';
    alertBox.style.display = 'block';

    setTimeout(() => {
      alertContainer.style.bottom = '-100px';
      setTimeout(() => {
        alertBox.style.display = 'none';
      }, 500); // 0.5 秒後隱藏提示框
    }, 3000); // 3 秒後隱藏提示框
  }

  // tslint:disable-next-line:typedef
  openDialog(classCadreX: ClassCadreRecord): void {
    // console.log('open dialog');
    const dialogRef = this.dialog.open(AddCadreDialogComponent, {
      width: '250px',
      data: {
        classCadre: classCadreX,
        students: this.studentList,
        schoolYear: this.selectedSchoolYear,
        semester: this.selectedSemester,
        class: this.selectedClass
      }
    });

    dialogRef.afterClosed().subscribe(async result => {
      // console.log('The dialog was closed');
      // console.log(result);
      await this.reloadCadreData();
    });
  }

  /** 匯出成 Excel 檔案 */
  // tslint:disable-next-line:typedef
  exportToExcel() {
    const data = [];

    this.classCadres.forEach(classCadre => {
      const item = {
        學年度: this.selectedSchoolYear,
        學期: this.selectedSemester,
        幹部: classCadre.cadreType.Cadrename,
        班級: this.selectedClass.ClassName,
        座號: (classCadre.student ? classCadre.student.SeatNo : ''),
        姓名: (classCadre.student ? classCadre.student.StudentName : ''),
        學號: (classCadre.student ? classCadre.student.StudentNumber : ''),
      };
      data.push(item);
    });

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '班級幹部');

    /* save to file */
    const fileName = `${this.selectedClass.ClassName}班級幹部名冊.xlsx`;
    XLSX.writeFile(wb, fileName);
  }
}

