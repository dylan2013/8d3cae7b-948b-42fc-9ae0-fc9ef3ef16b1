import { AddCadreDialogComponent } from './../add-cadre-dialog/add-cadre-dialog.component';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CadreService, CadreTypeInfo, ClassInfo, StudentInfo, CadreInfo, ClassCadreRecord } from './../../dal/cadre.service';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import * as XLSX from 'xlsx';
import * as moment from 'moment';

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

  moment = require('moment'); // 使用元件
  currentDateTime: any;       // 可以設定幹部的期間
  selectedStart;  // 開始日期
  selectedEnd;      // 結束日期
  selectedNow;      // 結束日期

  isCanSelectCarde = true;  // 是否是目前學年學期。如果是，才可以編輯資料。

  isCurrentSemester = true;  // 是否是目前學年學期。如果是，才可以編輯資料。
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

    this.schoolYearNumbers.push(this.selectedSchoolYear - 2);
    this.schoolYearNumbers.push(this.selectedSchoolYear - 1);
    this.schoolYearNumbers.push(this.selectedSchoolYear);
    this.schoolYearNumbers.push(this.selectedSchoolYear + 1);

  }

  async getOpenTeacherCadreDate() {
    // this.semesters = await this.cadreService.getSemestersByClassID(this.selectedClass.ClassID);
    // console.log(this.semesters);
    this.currentDateTime = await this.cadreService.getOpenTeacherCadreDate();


    const startDate = moment(this.currentDateTime.Response.StartDate);
    const endDate = moment(this.currentDateTime.Response.EndDate);
    const nowDate = moment(this.currentDateTime.Response.Now);

    if (nowDate.format("YYYY-MM-DD") >= startDate.format("YYYY-MM-DD")
    && nowDate.format("YYYY-MM-DD") <= endDate.format("YYYY-MM-DD")){
      this.isCanSelectCarde = true;
    } else {
      this.isCanSelectCarde = false;
    }

    console.log("開始時間 : " + startDate.format("YYYY-MM-DD"));
    console.log("結束時間 : " + endDate.format("YYYY-MM-DD"));
    console.log("目前時間 : " + nowDate.format("YYYY-MM-DD"));

    this.selectedStart = startDate.format("YYYY-MM-DD"); // 開始日期
    this.selectedEnd = endDate.format("YYYY-MM-DD"); // 結束日期
    this.selectedNow = nowDate.format("YYYY-MM-DD"); // 目前日期
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
    // console.log(classCadre.cadre.uid);
    await this.cadreService.deleteCadre(classCadre.cadre.uid);
    await this.reloadCadreData();
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

