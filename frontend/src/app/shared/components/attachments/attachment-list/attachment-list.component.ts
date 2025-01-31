// -- copyright
// OpenProject is an open source project management software.
// Copyright (C) 2012-2022 the OpenProject GmbH
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License version 3.
//
// OpenProject is a fork of ChiliProject, which is a fork of Redmine. The copyright follows:
// Copyright (C) 2006-2013 Jean-Philippe Lang
// Copyright (C) 2010-2013 the ChiliProject Team
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
//
// See COPYRIGHT and LICENSE files for more details.
//++

import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnInit,
} from '@angular/core';
import { map, tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { HalResource } from 'core-app/features/hal/resources/hal-resource';
import { IAttachment } from 'core-app/core/state/attachments/attachment.model';
import { TimezoneService } from 'core-app/core/datetime/timezone.service';
import { UntilDestroyedMixin } from 'core-app/shared/helpers/angular/until-destroyed.mixin';
import { AttachmentsResourceService } from 'core-app/core/state/attachments/attachments.service';
import isNewResource from 'core-app/features/hal/helpers/is-new-resource';

@Component({
  selector: 'op-attachment-list',
  templateUrl: './attachment-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttachmentListComponent extends UntilDestroyedMixin implements OnInit {
  @Input() public resource:HalResource;

  $attachments:Observable<IAttachment[]>;

  private get attachmentsSelfLink():string {
    const attachments = this.resource.attachments as unknown&{ href:string };
    return attachments.href;
  }

  private get collectionKey():string {
    return isNewResource(this.resource) ? 'new' : this.attachmentsSelfLink;
  }

  constructor(
    private readonly timezoneService:TimezoneService,
    private readonly attachmentsResourceService:AttachmentsResourceService,
  ) {
    super();
  }

  ngOnInit():void {
    // ensure collection is loaded to the store
    if (!isNewResource(this.resource)) {
      this.attachmentsResourceService.requireCollection(this.attachmentsSelfLink);
    }

    const compareCreatedAtTimestamps = (a:IAttachment, b:IAttachment):number => {
      const rightCreatedAt = this.timezoneService.parseDatetime(b.createdAt);
      const leftCreatedAt = this.timezoneService.parseDatetime(a.createdAt);
      return rightCreatedAt.isBefore(leftCreatedAt) ? -1 : 1;
    };

    this.$attachments = this
      .attachmentsResourceService
      .collection(this.collectionKey)
      .pipe(
        this.untilDestroyed(),
        map((attachments) => attachments.sort(compareCreatedAtTimestamps)),
        // store attachments for new resources directly into the resource. This way, the POST request to create the
        // resource embeds the attachments and the backend reroutes the anonymous attachments to the resource.
        tap((attachments) => {
          if (isNewResource(this.resource)) {
            this.resource.attachments = { elements: attachments.map((a) => a._links.self) };
          }
        }),
      );
  }

  public removeAttachment(attachment:IAttachment):void {
    this.attachmentsResourceService.removeAttachment(this.collectionKey, attachment).subscribe();
  }
}
